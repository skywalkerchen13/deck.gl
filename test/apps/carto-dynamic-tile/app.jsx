/* global document */
/* eslint-disable no-console */
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {CartoLayer, FORMATS, MAP_TYPES} from '@deck.gl/carto';
import {GeoJsonLayer} from '@deck.gl/layers';

const INITIAL_VIEW_STATE = {longitude: -100, latitude: 45, zoom: 3};
const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

// Skip CDN
// const apiBaseUrl = 'https://direct-gcp-us-east1.api.carto.com';
// PROD US GCP
const apiBaseUrl = 'https://gcp-us-east1.api.carto.com';
// const apiBaseUrl = 'https://gcp-us-east1-06.dev.api.carto.com';
// Localhost
// const apiBaseUrl = 'http://localhost:8002'

const config = {
  bigquery: {
    zcta: 'carto-dev-data.tilesets.geography_usa_zcta5_2019_tileset_properties'
  }
};

const accessToken = 'XXX';

const showBasemap = true;
const showCarto = true;

function Root() {
  const [connection, setConnection] = useState('bigquery');
  const [dataset, setDataset] = useState('zcta');
  const table = config[connection][dataset];
  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[showBasemap && createBasemap(), showCarto && createCarto(connection, table)]}
      />
      <ObjectSelect
        title="connection"
        obj={Object.keys(config)}
        value={connection}
        onSelect={c => {
          setConnection(c);
          if (!config[c][dataset]) {
            setDataset(Object.keys(config[c])[0]);
          }
        }}
      />
      <ObjectSelect
        title="dataset"
        obj={Object.keys(config[connection])}
        value={dataset}
        onSelect={setDataset}
      />
    </>
  );
}

function createBasemap() {
  return new GeoJsonLayer({
    id: 'base-map',
    data: COUNTRIES,
    // Styles
    stroked: true,
    filled: true,
    lineWidthMinPixels: 2,
    opacity: 0.4,
    getLineColor: [60, 60, 60],
    getFillColor: [200, 200, 200]
  });
}

// Add aggregation expressions
function createCarto(connection, table) {
  const geoColumn = 'blah';
  return new CartoLayer({
    id: 'carto',
    connection,
    data: table,
    credentials: {accessToken, apiBaseUrl},

    // Dynamic tiling. Request TILEJSON format with TABLE
    type: MAP_TYPES.TILESET,

    // autohighlight
    pickable: true,
    autoHighlight: true,
    highlightColor: [33, 77, 255, 255],

    // Styling
    getFillColor: d => {
      const {geoid} = d.properties;
      return [geoid % 255, geoid % 671, geoid % 5128];
    }
  });
}

function ObjectSelect({title, obj, value, onSelect}) {
  const keys = Object.values(obj).sort();
  return (
    <>
      <select
        onChange={e => onSelect(e.target.value)}
        style={{position: 'relative', padding: 4, margin: 2, width: 200}}
        value={value}
      >
        <option hidden>{title}</option>
        {keys.map(f => (
          <option key={f} value={f}>
            {`${title}: ${f}`}
          </option>
        ))}
      </select>
      <br></br>
    </>
  );
}

const container = document.body.appendChild(document.createElement('div'));
createRoot(container).render(<Root />);
