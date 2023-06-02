/* global document */
/* eslint-disable no-console */
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {CartoLayer, FORMATS, MAP_TYPES} from '@deck.gl/carto';
import {GeoJsonLayer} from '@deck.gl/layers';

const INITIAL_VIEW_STATE = {longitude: -100, latitude: 45, zoom: 4};
const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

const config = {
  carto_dw: {
    zcta: 'carto-dev-data.named_areas_tilesets.geography_usa_zcta5_2019_tileset'
  },
  snowflake: {
    zcta: 'CARTO_DEV_DATA.TILESETS.GEOGRAPHY_USA_ZCTA5_2019_TILESET_PROPERTIES2'
  }
};

const accessToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRVNGNZTHAwaThjYnVMNkd0LTE0diJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImZwYWxtZXJAY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfN3hoZnd5bWwiLCJpc3MiOiJodHRwczovL2F1dGguY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA3OTY5NjU1OTI5NjExMjIxNDg2IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTY4NTYwODgzNSwiZXhwIjoxNjg1Njk1MjM1LCJhenAiOiJBdHh2SERldVhsUjhYUGZGMm5qMlV2MkkyOXB2bUN4dSIsInBlcm1pc3Npb25zIjpbImV4ZWN1dGU6d29ya2Zsb3dzIiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInJlYWQ6d29ya2Zsb3dzIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjYXJ0by1kdy1ncmFudHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIiwid3JpdGU6d29ya2Zsb3dzIl19.ltg7MdS1R-tLxyLMJ5MlJGPtJqzMi7-__OgdY5ceYk1aqHQhUyD75lEhpAYVdP2CvoY6qJOfE6PpnI4mM9XPzbscSqA87h2EUnfkYY0XctO289ZqFP7m-BQNXI9t9_a1tTTVYJPmqV2j8BoJNMaRdOJmnEHMVLUNGvIiZdpzYxkGywr_F7DJPQUnIZg8g-JtVTS2hKcfTvYQPSyZtz-4NtWw7CWAhne2kyY0R6aWycEnGCefuksOHQ40xffmkJ0H9tj5xF5pd6Wb3xMyRnhFD3Qi-3WQYGHuX5chcDD-oOgRAGU9Is3tzsU1cqtBcJmz_-7alPNH4BqXLmSg3r8gfg';

const showBasemap = true;
const showCarto = true;

function Root() {
  const [connection, setConnection] = useState('carto_dw');
  const [localCache, setLocalCache] = useState(true);
  const [dataset, setDataset] = useState('zcta');
  const tileset = config[connection][dataset];
  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[
          showBasemap && createBasemap(),
          showCarto && createCarto(connection, tileset, localCache)
        ]}
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
      <button
        style={{position: 'relative', margin: 3}}
        onClick={() => {
          setLocalCache(!localCache);
        }}
      >
        {localCache ? 'Use server data' : 'Use local cache'}
      </button>
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
function createCarto(connection, tileset, localCache) {
  // Use local cache to speed up API. See `examples/vite.config.local.mjs`
  const apiBaseUrl = localCache ? '/carto-api' : 'https://gcp-us-east1.api.carto.com';
  return new CartoLayer({
    id: 'carto',
    connection,
    credentials: {accessToken, apiBaseUrl},

    // Named areas props
    type: MAP_TYPES.TILESET,
    uniqueIdProperty: 'geoid', // Property on which to perform the spatial JOIN
    data: tileset, // Specify the tileset from which to fetch the columns. Must include columns specified in `columns`
    columns: ['total_pop'], // Columns to fetch from tileset specified in `data` prop
    // columns: ['poverty', 'total_pop', 'gini_index'],
    geoColumn: `namedArea:${tileset}`, // Named area geometry source. Must be a tileset with a `uniqueIdProperty` column. All other columns will be ignored.

    // autohighlight
    pickable: true,
    autoHighlight: true,
    highlightColor: [33, 77, 255, 255],

    // Styling
    getFillColor: d => {
      const total_pop = d.properties.total_pop / 100;
      return [255 - total_pop, total_pop, 0];
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
