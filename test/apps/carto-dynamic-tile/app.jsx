/* global document */
/* eslint-disable no-console */
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StaticMap} from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import {CartoLayer, colorBins, FORMATS, MAP_TYPES} from '@deck.gl/carto';
import {GeoJsonLayer} from '@deck.gl/layers';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
const INITIAL_VIEW_STATE = {longitude: -70, latitude: 45, zoom: 7};
const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

const config = {
  bigquery: {
    blockgroup: {
      attributes: `select avg(txn_amt) as txn_amt, geoid FROM carto-dev-data.private.financial_geographicinsights_usa_blockgroup_2015_daily_v1_partitioned WHERE do_date between '2022-08-01' and '2022-08-07' group by geoid`,
      geometryTileset: 'carto-dev-data.named_areas_tilesets.geography_usa_blockgroup_2019_tileset',
      getFillColor: colorBins({
        attr: 'txn_amt',
        domain: [0, 10, 50, 100, 250, 500, 1000],
        colors: 'OrYel'
      }),
      type: MAP_TYPES.QUERY
    }
  },
  carto_dw: {
    zcta: {
      attributes:
        'carto-dev-data.named_areas_tilesets.sub_usa_acs_demographics_sociodemographics_usa_zcta5_2015_5yrs_20112015',
      geometryTileset: 'carto-dev-data.named_areas_tilesets.geography_usa_zcta5_2019_tileset',
      getFillColor: colorBins({
        attr: 'total_pop',
        domain: [0, 1, 5, 10, 25, 50, 100].map(n => 1000 * n),
        colors: 'Purp'
      }),
      type: MAP_TYPES.TABLE
    }
  }
};
const COLUMNS = {
  txn_amt: false,
  family_households: false,
  four_more_cars: false,
  gini_index: false,
  in_school: false,
  poverty: false,
  total_pop: true,
  walked_to_work: false
};

const accessToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRVNGNZTHAwaThjYnVMNkd0LTE0diJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImZwYWxtZXJAY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfN3hoZnd5bWwiLCJpc3MiOiJodHRwczovL2F1dGguY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA3OTY5NjU1OTI5NjExMjIxNDg2IiwiYXVkIjoiY2FydG8tY2xvdWQtbmF0aXZlLWFwaSIsImlhdCI6MTY4NjI5NTk1NywiZXhwIjoxNjg2MzgyMzU3LCJhenAiOiJBdHh2SERldVhsUjhYUGZGMm5qMlV2MkkyOXB2bUN4dSIsInBlcm1pc3Npb25zIjpbImV4ZWN1dGU6d29ya2Zsb3dzIiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInJlYWQ6d29ya2Zsb3dzIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjYXJ0by1kdy1ncmFudHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIiwid3JpdGU6d29ya2Zsb3dzIl19.RvEpJHS6bpfekZr21n1a7P42PQ8mxOWPyKgoV8VtRmHOdhfE9j1UqlWf_GLA5rSrG53B_NFFVVfgBaOEhKE-mjlfja6Nm7MAeTk29jorB5wOz_DUR0t7RCpMna88ALiHSWJjYbFp-EXf7p_sHEJMfmpaeWXponEDypOQBUm1kZj2xFHILTr5f74i7SBmgelwhIsdyu9bdAauHECUKW_mOp5q7_C_aHJaN64n5txHk1enMp9Oq9MbhBmnmheLzu1QnV2d9rmuHE4apF-gYwVMB5Hyf0HNZnKEWiPs7NEzr_Uzu3pwsi3ZP0XPSYIBhCkIBdlPZLUeDSkBCfztV75d9w';

const showBasemap = false;
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
  const datasource = config[connection][dataset];
  const cols = trueKeys(columns);
  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[
          showBasemap && createBasemap(),
          showCarto && createCarto(connection, datasource, cols, localCache)
        ]}
        getTooltip={getTooltip}
      >
        <StaticMap mapStyle={MAP_STYLE} />
      </DeckGL>
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
      {false && (
        <button
          style={{position: 'relative', margin: 3}}
          onClick={() => {
            setLocalCache(!localCache);
          }}
        >
          {localCache ? 'Use server data' : 'Use local cache'}
        </button>
      )}
      <pre style={{}}>
        {`CartoLayer({
  type: "${datasource.type}",
  uniqueIdProperty: "geoid",
  data: "${datasource.attributes}",
  columns: ${JSON.stringify(cols)},
  geoColumn: "boundaries:${datasource.geometryTileset}"
})`}
      </pre>
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
function createCarto(connection, datasource, columns, localCache) {
  // Use local cache to speed up API. See `examples/vite.config.local.mjs`
  const apiBaseUrl = localCache ? '/carto-api' : 'https://gcp-us-east1.api.carto.com';
  const {attributes, geometryTileset, getFillColor, type} = datasource;
  return new CartoLayer({
    id: 'carto',
    connection,
    credentials: {accessToken, apiBaseUrl},

    // Named areas props
    type,
    uniqueIdProperty: 'geoid', // Property on which to perform the spatial JOIN
    data: attributes, // Specify the table from which to fetch the columns. Must include columns specified in `columns`
    columns, // Columns to fetch from table specified in `data` prop
    geoColumn: `boundaries:${geometryTileset}`, // Named area geometry source. Must be a tileset with a `uniqueIdProperty` column. All other columns will be ignored.

    // Styling
    pickable: true,
    getFillColor
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
