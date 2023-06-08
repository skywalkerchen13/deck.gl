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

  // HACK: This logic will be performed at the API level in the future
  getQueryUrl(tile: TileLoadProps, tilesetUrl: string) {
    // These parameters will be passed up to the API
    const {
      credentials: {apiBaseUrl},
      connection,
      columns,
      data,
      uniqueIdProperty
    } = this.parent.props;
    const searchParams = new URL(tilesetUrl).searchParams;
    const tileset = searchParams.get('name');
    // const partition = '0_12_9_4094_868_2216_3999_1';
    const partition = searchParams.get('partition');

    // Construction of query will be done server-side
    const {x, y, z} = tile.index;
    // const {x, y, z} = {x: 1006, y: 1539, z: 12};

    const [zmin, zmax, xmin, xmax, ymin, ymax, partitions, zstep] = partition.split('_');
    const zRange = {zmin, zmax, zstep};
    const zMaxBbox = {xmin, xmax, ymin, ymax};
    const Partitioner = new GilbertPartition(partitions, zRange, zMaxBbox);
    const p = Partitioner.getPartition({z, x, y});
    // const p = 1895;

    //const dataQuery = `select ${uniqueIdProperty}, ${columns.join(', ')} FROM ${data}`;
    const dataQuery = `select avg(txn_amt) as txn_amt, ${uniqueIdProperty} FROM ${data} WHERE do_date between '2022-08-01' and '2022-08-07' group by geoid`;
    const spatialFilter = `z=${z} AND y=${y} AND x=${x} AND carto_partition=${p}`;
    const query = `
    WITH ids AS (
      SELECT geoids FROM ${tileset} WHERE ${spatialFilter}
    ), data_source AS (
      ${dataQuery}
    )

    SELECT * FROM data_source a, ids
      WHERE a.${uniqueIdProperty} IN (select * from unnest(ids.geoids))
    `;

    const query2 = `
WITH ids AS (
      SELECT geoids 
        FROM carto-dev-data.named_areas_tilesets.geography_usa_blockgroup_2019_tileset
        WHERE z=12 AND y=1539 AND x=1006 AND carto_partition=1563
    ), data_source AS (
      SELECT avg(txn_amt) as txn_amt, geoid
    FROM carto-dev-data.private.financial_geographicinsights_usa_blockgroup_2015_daily_v1_partitioned
    WHERE do_date between '2022-08-01' and '2022-08-07'
    group by geoid
    )

    SELECT * FROM data_source a, ids
     WHERE a.geoid IN (select * from unnest(ids.geoids))`;

    return `${apiBaseUrl}/v3/sql/${connection}/query?q=${encodeURI(query)}`;
  }

  async getTileData(tile: TileLoadProps) {
    const url = _getURLFromTemplate(this.state.data, tile);
    if (!url) {
      return Promise.reject('Invalid URL');
    }

    let loadOptions = this.getLoadOptions();
    const {fetch, formatTiles} = this.props;
    const {signal} = tile;

    if (formatTiles === TILE_FORMATS.BINARY) {
      // The backend doesn't yet support our custom mime-type, so force it here
      // TODO remove once backend sends the correct mime-type
      loadOptions = {...loadOptions, mimeType: 'application/vnd.carto-vector-tile'};
    } else if (formatTiles === TILE_FORMATS.MVT) {
      loadOptions = {...loadOptions, gis: {format: 'binary'}};
    }

    // Fetch geometry and attributes separately
    const geometryFetch = fetch(url, {propName: 'data', layer: this, loadOptions, signal});
    const attributesFetch = fetch(this.getQueryUrl(tile, this.state.data[0]), {
      propName: 'data',
      layer: this,
      loadOptions: {...loadOptions, mimeType: 'application/json'},
      signal
    });
    const [geometry, attributes] = await Promise.all([geometryFetch, attributesFetch]);
    if (!geometry) return null;

    // Map across attribute data
    // TODO may want to rethink this depending on data format & time series
    const mapping = {};
    for (const {geoid, ...rest} of attributes.rows) {
      mapping[geoid] = rest;
    }

    // TODO only supporting polygons?
    geometry.polygons.properties = geometry.polygons.properties.map(
      ({geoid, GEOID}) => mapping[geoid] || mapping[GEOID]
    );
    return geometry;
  }

  renderSubLayers(
    props: TileLayer['props'] & {
      id: string;
      data: any;
      _offset: number;
      tile: _Tile2DHeader;
    }
  ): GeoJsonLayer | null {
    if (props.data === null) {
      return null;
    }

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
