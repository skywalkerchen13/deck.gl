/* global document */
/* eslint-disable no-console */
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {CartoLayer, MAP_TYPES} from '@deck.gl/carto';
import {GeoJsonLayer} from '@deck.gl/layers';

const INITIAL_VIEW_STATE = {longitude: 8, latitude: 47, zoom: 6};
const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

// Skip CDN
// const apiBaseUrl = 'https://direct-gcp-us-east1.api.carto.com';
// PROD US GCP
const apiBaseUrl = 'https://gcp-us-east1.api.carto.com';
// const apiBaseUrl = 'https://gcp-us-east1-06.dev.api.carto.com';
// Localhost
// const apiBaseUrl = 'http://localhost:8002'

const accessToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRVNGNZTHAwaThjYnVMNkd0LTE0diJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6Imltb3Jlbm9AY2FydG9kYi5jb20iLCJodHRwOi8vYXBwLmNhcnRvLmNvbS9hY2NvdW50X2lkIjoiYWNfN3hoZnd5bWwiLCJpc3MiOiJodHRwczovL2F1dGguY2FydG8uY29tLyIsInN1YiI6Imdvb2dsZS1vYXV0aDJ8MTA4MzQzNDkzNTAzODQ0MjcyNTExIiwiYXVkIjpbImNhcnRvLWNsb3VkLW5hdGl2ZS1hcGkiLCJodHRwczovL2NhcnRvLXByb2R1Y3Rpb24udXMuYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTY4NzE1NzExNywiZXhwIjoxNjg3MjQzNTE3LCJhenAiOiJqQ1duSEs2RTJLMmFPeTlqTHkzTzdaTXBocUdPOUJQTCIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgcmVhZDpjdXJyZW50X3VzZXIgdXBkYXRlOmN1cnJlbnRfdXNlciByZWFkOmNvbm5lY3Rpb25zIHdyaXRlOmNvbm5lY3Rpb25zIHJlYWQ6bWFwcyB3cml0ZTptYXBzIHJlYWQ6YWNjb3VudCIsInBlcm1pc3Npb25zIjpbImV4ZWN1dGU6d29ya2Zsb3dzIiwicmVhZDphY2NvdW50IiwicmVhZDphcHBzIiwicmVhZDpjb25uZWN0aW9ucyIsInJlYWQ6Y3VycmVudF91c2VyIiwicmVhZDppbXBvcnRzIiwicmVhZDpsaXN0ZWRfYXBwcyIsInJlYWQ6bWFwcyIsInJlYWQ6dGlsZXNldHMiLCJyZWFkOnRva2VucyIsInJlYWQ6d29ya2Zsb3dzIiwidXBkYXRlOmN1cnJlbnRfdXNlciIsIndyaXRlOmFwcHMiLCJ3cml0ZTpjYXJ0by1kdy1ncmFudHMiLCJ3cml0ZTpjb25uZWN0aW9ucyIsIndyaXRlOmltcG9ydHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIiwid3JpdGU6d29ya2Zsb3dzIl19.ECwt8rYGK4Qp1ACOSwoD-w_iObaRKZEjVEOjpVT1mxPcEU-yEN5c-BbArlGR1wANx_DpfUziI-JXTHbcIt7LKKkV-oJC3ednBVqbSwHqCiZGS6GG__KZm-TKmB64wfFVs-z_tgT5GlsIxyn0uBwThqrZhmY0xJJPveyXCYvAac66-h2vIHuK6JfWNIEfiRo5yMsrMsVihUqiwd3lIbZcTWnauoj4ZdbKwDiTLwyUQdbtThgnh0Q6GD_E554hIPR2uCFkcSAZRVnoT9k_867nLa6TfD0LSMFebSRfWxFQCRrKl0bgmIhvYEVJOLBsA6Cv86cgm6MtCnc0dcPVaCb33g';

const showBasemap = true;
const showCarto = true;

function Root() {
  const [connection, setConnection] = useState('bigquery');
  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[
          showBasemap && createBasemap(),
          showCarto && createCarto(connection)
        ]}
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
function createCarto(connection) {
  
  return new CartoLayer({
    type: MAP_TYPES.TABLE,
    connection,
    credentials: {accessToken, apiBaseUrl},
    data: 'cartobq.testtables.points_10k',
    formatTiles: 'binary',
    pointRadiusScale: 1,
    pointRadiusMinPixels: 1,
    pointRadiusMinPixels: 10,
    pointRadiusUnits: 'pixels',
    getRadius: (d) => {
      return Math.pow(10, d.properties.point_order / 10)
    },
    getLineColor: [0, 0, 0, 200],
    getFillColor: [238, 77, 90],
    lineWidthMinPixels: 1,
    timeseries: {
      column: 'date',
      start: '01-01-2023T00:00:00Z',
      end: '01-01-2023T00:00:00Z',
      aggregation: 'avg'
    }
  })
}

const container = document.body.appendChild(document.createElement('div'));
createRoot(container).render(<Root />);
