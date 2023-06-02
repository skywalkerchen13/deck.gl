import {registerLoaders} from '@loaders.gl/core';
import CartoVectorTileLoader from './schema/carto-vector-tile-loader';
registerLoaders([CartoVectorTileLoader]);

import {DefaultProps} from '@deck.gl/core';
import {ClipExtension} from '@deck.gl/extensions';
import {
  MVTLayer,
  MVTLayerProps,
  TileLayer,
  _getURLFromTemplate,
  _Tile2DHeader,
  _TileLoadProps as TileLoadProps
} from '@deck.gl/geo-layers';
import {GeoJsonLayer} from '@deck.gl/layers';
import {binaryToGeojson} from '@loaders.gl/gis';
import type {BinaryFeatures} from '@loaders.gl/schema';
import {TileFormat, TILE_FORMATS} from '../api/maps-api-common';
import type {Feature} from 'geojson';
import GilbertPartition from './gilbert-partition';

const defaultTileFormat = TILE_FORMATS.BINARY;

const defaultProps: DefaultProps<CartoTileLayerProps> = {
  ...MVTLayer.defaultProps,
  formatTiles: defaultTileFormat
};

/** All properties supported by CartoTileLayer. */
export type CartoTileLayerProps = _CartoTileLayerProps & MVTLayerProps;

/** Properties added by CartoTileLayer. */
type _CartoTileLayerProps = {
  /** Use to override the default tile data format.
   *
   * Possible values are: `TILE_FORMATS.BINARY`, `TILE_FORMATS.GEOJSON` and `TILE_FORMATS.MVT`.
   *
   * Only supported when `apiVersion` is `API_VERSIONS.V3` and `format` is `FORMATS.TILEJSON`.
   */
  formatTiles?: TileFormat;
};

export default class CartoTileLayer<ExtraProps extends {} = {}> extends MVTLayer<
  Required<_CartoTileLayerProps> & ExtraProps
> {
  static layerName = 'CartoTileLayer';
  static defaultProps = defaultProps;

  initializeState(): void {
    super.initializeState();
    const binary = this.props.formatTiles === TILE_FORMATS.BINARY || TILE_FORMATS.MVT;
    this.setState({binary});
  }

  getQueryUrl(tile: TileLoadProps) {
    // const tileset = this.props.data.name;
    const tileset = 'carto-dev-data.named_areas_tilesets.geography_usa_zcta5_2019_tileset';
    const {x, y, z} = tile.index;

    const partition = '0_12_37_3708_870_2214_3999_1';
    const [zmin, zmax, xmin, xmax, ymin, ymax, partitions, zstep] = partition.split('_');
    const zRange = {zmin, zmax, zstep};
    const zMaxBbox = {xmin, xmax, ymin, ymax};
    const Partitioner = new GilbertPartition(partitions, zRange, zMaxBbox);
    const p = Partitioner.getPartition({z, x, y});

    const {uniqueIdProperty} = this.props;
    const columns = ['total_pop'];
    const dataQuery = `select ${uniqueIdProperty}, ${columns.join(
      ', '
    )} FROM carto-dev-data.named_areas_tilesets.sub_usa_acs_demographics_sociodemographics_usa_zcta5_2015_5yrs_20112015`;

    const query = `
    WITH ids AS (
      SELECT geoids
        FROM ${tileset}
        WHERE z=${z} AND y=${y} AND x=${x} AND carto_partition=${p}
    ), data_source AS (
      ${dataQuery}
    )

    SELECT ${uniqueIdProperty}, ${columns.join(', ')} FROM data_source a, ids
     WHERE a.${uniqueIdProperty} IN (select * from unnest(ids.geoids))
    `;

    // Construct request to query API
    const {
      //connection,
      credentials: {apiBaseUrl}
    } = this.props;
    const connection = 'carto_dw';
    const queryUrl = `${apiBaseUrl}/v3/sql/${connection}/query?q=${encodeURI(query)}`;

    return queryUrl;
  }

  getTileData(tile: TileLoadProps) {
    const url = _getURLFromTemplate(this.state.data, tile);
    if (!url) {
      return Promise.reject('Invalid URL');
    }

    let loadOptions = this.getLoadOptions();
    const {fetch, formatTiles} = this.props;
    const {signal} = tile;

    // The backend doesn't yet support our custom mime-type, so force it here
    // TODO remove once backend sends the correct mime-type
    if (formatTiles === TILE_FORMATS.BINARY) {
      loadOptions = {
        ...loadOptions,
        mimeType: 'application/vnd.carto-vector-tile'
      };
    } else if (formatTiles === TILE_FORMATS.MVT) {
      loadOptions = {
        ...loadOptions,
        mimeType: 'application/x-protobuf',
        mvt: {
          ...loadOptions?.mvt,
          coordinates: this.context.viewport.resolution ? 'wgs84' : 'local',
          tileIndex: tile.index
        },
        gis: {format: 'binary'}
      };
    }

    // Fetch geometry and attributes separately
    const geometry = fetch(url, {propName: 'data', layer: this, loadOptions, signal});
    const attributes = fetch(this.getQueryUrl(tile), {
      propName: 'data',
      layer: this,
      loadOptions: {...loadOptions, mimeType: 'application/json'},
      signal
    });

    return Promise.all([geometry, attributes]);
  }

  renderSubLayers(
    props: TileLayer['props'] & {
      id: string;
      data: any;
      _offset: number;
      tile: _Tile2DHeader;
    }
  ): GeoJsonLayer | null {
    if (props.data === null || props.data[0] === null) {
      return null;
    }

    // JOIN data
    const [geometry, attributes] = props.data;

    // // HACK remove all attributes from geometry request, except GEOID
    // // Final response will only include geometry data & GEOID
    geometry.polygons.numericProps = {};

    // Map across attribute data
    const mapping = {};
    for (const {geoid, ...rest} of attributes.rows) {
      mapping[geoid] = rest;
    }

    geometry.polygons.properties = geometry.polygons.properties.map(
      ({geoid, GEOID}) => mapping[geoid] || mapping[GEOID]
    );
    props.data = geometry;

    if (this.props.formatTiles === TILE_FORMATS.MVT) {
      return super.renderSubLayers(props);
    }

    const tileBbox = props.tile.bbox as any;
    const {west, south, east, north} = tileBbox;

    const subLayerProps = {
      ...props,
      autoHighlight: false,
      extensions: [new ClipExtension(), ...(props.extensions || [])],
      clipBounds: [west, south, east, north]
    };

    const subLayer = new GeoJsonLayer(subLayerProps);
    return subLayer;
  }

  getPickingInfo(params) {
    const info = super.getPickingInfo(params);

    if (this.state.binary && info.index !== -1) {
      const {data} = params.sourceLayer!.props;
      info.object = binaryToGeojson(data as BinaryFeatures, {
        globalFeatureId: info.index
      }) as Feature;
    }

    return info;
  }
}
