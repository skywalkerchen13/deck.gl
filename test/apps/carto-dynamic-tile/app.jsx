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
    zcta: {
      geometryTileset: 'carto-dev-data.named_areas_tilesets.geography_usa_zcta5_2019_tileset',
      attributeTable:
        'carto-dev-data.named_areas_tilesets.sub_usa_acs_demographics_sociodemographics_usa_zcta5_2015_5yrs_20112015'
    }
  }
};
const COLUMNS = {
  family_households: false,
  four_more_cars: false,
  gini_index: false,
  in_school: false,
  poverty: false,
  total_pop: true,
  walked_to_work: false
};

const accessToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRVNGNZTHAwaThjYnVMNkd0LTE0diJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImZwYWxtZXJAY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfN3hoZnd5bWwiLCJpc3MiOiJodHRwczovL2F1dGguY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA3OTY5NjU1OTI5NjExMjIxNDg2IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTY4NjEzNDAzNCwiZXhwIjoxNjg2MjIwNDM0LCJhenAiOiJBdHh2SERldVhsUjhYUGZGMm5qMlV2MkkyOXB2bUN4dSIsInBlcm1pc3Npb25zIjpbImV4ZWN1dGU6d29ya2Zsb3dzIiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInJlYWQ6d29ya2Zsb3dzIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjYXJ0by1kdy1ncmFudHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIiwid3JpdGU6d29ya2Zsb3dzIl19.ds9nfosANJNelmmqoIXgA0ay54k31cwAGo4s-Q1wpScWxcpEOXaHB45jvXSCsKvEP9ykxSfGoQlLy7QyZpIv4U4x7WAnw1R_48sBW8k_4wSyyJCv4axL8ph0aclhk1oUsD6AI6y-yIvEZK06f1RbxZMmoxzbk1FpIs6UZmoAlQyt0Z1tH0tnTxQfFBBM1AH7xelW_bcJfU7hRI7HUa1dA7F0O11m1zntZ30RQwnv56pUILnmZfexR00YwT7ZepuwS6AnPlg3xgTaT7mkZCeB533IvplNU1lCtpkiULHARUkflGs1QSYWJifTB0pLlqRCbL1I-QSlAqKxb6ebe3iPDQ';

const showBasemap = true;
const showCarto = true;

function getTooltip({object}) {
  if (!object) {
    return null;
  }
  return Object.entries(object.properties)
    .map(([k, v]) => `${k}: ${v}\n`)
    .join('');
}

function Root() {
  const [columns, setColumns] = useState(COLUMNS);
  const [connection, setConnection] = useState('carto_dw');
  const [localCache, setLocalCache] = useState(true);
  const [dataset, setDataset] = useState('zcta');
  const datasources = config[connection][dataset];
  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[
          showBasemap && createBasemap(),
          showCarto && createCarto(connection, datasources, columns, localCache)
        ]}
        getTooltip={getTooltip}
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
      <MultiSelect
        obj={COLUMNS}
        onChange={e => {
          setColumns({...e});
        }}
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
function createCarto(connection, datasources, columns, localCache) {
  // Use local cache to speed up API. See `examples/vite.config.local.mjs`
  const apiBaseUrl = localCache ? '/carto-api' : 'https://gcp-us-east1.api.carto.com';
  const {geometryTileset, attributeTable} = datasources;
  return new CartoLayer({
    id: 'carto',
    connection,
    credentials: {accessToken, apiBaseUrl},

    // Named areas props
    type: MAP_TYPES.TABLE,
    uniqueIdProperty: 'geoid', // Property on which to perform the spatial JOIN
    data: attributeTable, // Specify the table from which to fetch the columns. Must include columns specified in `columns`
    columns: trueKeys(columns), // Columns to fetch from table specified in `data` prop
    geoColumn: `namedArea:${geometryTileset}`, // Named area geometry source. Must be a tileset with a `uniqueIdProperty` column. All other columns will be ignored.

    // Styling
    pickable: true,
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

const boxStyle = {
  position: 'relative',
  background: 'rgba(255, 255, 255, 0.9)',
  padding: '4px 8px',
  margin: 3,
  width: 150
};
function MultiSelect({obj, onChange}) {
  return (
    <div style={boxStyle}>
      {Object.entries(obj).map(([key, value]) => (
        <Checkbox
          key={key}
          label={key}
          value={value}
          onChange={e => {
            obj[key] = e.target.checked;
            onChange(obj);
          }}
        />
      ))}
    </div>
  );
}

function Checkbox({label, value, onChange}) {
  return (
    <label>
      {label}:
      <input type="checkbox" checked={value} onChange={onChange} />
      <br />
    </label>
  );
}

function trueKeys(obj) {
  return Object.entries(obj)
    .filter(([k, v]) => v)
    .map(([k, v]) => k);
}

const container = document.body.appendChild(document.createElement('div'));
createRoot(container).render(<Root />);
