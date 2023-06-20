/* global document */
/* eslint-disable no-console */
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {Map} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import {Box, IconButton, Paper, Slider, makeStyles} from '@material-ui/core' 
import {PauseOutlined, PlayArrowOutlined} from '@material-ui/icons';
import {MAP_TYPES } from '@deck.gl/carto';
import useTorque from './useTorque';
import { LinearInterpolator } from 'deck.gl';

const INITIAL_VIEW_STATE = {longitude: -73.8, latitude: 40.7, zoom: 9};
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
const COUNTRIES =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson';

const apiBaseUrl = 'https://gcp-us-east1-04.dev.api.carto.com';
const accessToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InlscXg0SVg3ek1oaUR1OFplSUlFSyJ9.eyJodHRwOi8vYXBwLmNhcnRvLmNvbS9lbWFpbCI6ImluZnJhc3RydWN0dXJlK2RlZC0wMDQtMTI3MzAtMTY4NzI0OTAwNkBjYXJ0b2RiLmNvbSIsImh0dHA6Ly9hcHAuY2FydG8uY29tL2FjY291bnRfaWQiOiJhY19uMTJudDRzZiIsImlzcyI6Imh0dHBzOi8vYXV0aC5kZXYuY2FydG8uY29tLyIsInN1YiI6ImF1dGgwfDY0OTE2MDdhMDZiZWI5ZmNhMDg5MjE1YyIsImF1ZCI6WyJjYXJ0by1jbG91ZC1uYXRpdmUtYXBpIiwiaHR0cHM6Ly9jYXJ0by1kZWRpY2F0ZWQtZW52LnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE2ODcyNTI3MjMsImV4cCI6MTY4NzMzOTEyMywiYXpwIjoiRzNxN2wyVW9NelJYOG9zaG1BdXNlZDBwZ1FWV3JKR1AiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIHJlYWQ6Y3VycmVudF91c2VyIHVwZGF0ZTpjdXJyZW50X3VzZXIgcmVhZDpjb25uZWN0aW9ucyB3cml0ZTpjb25uZWN0aW9ucyByZWFkOm1hcHMgd3JpdGU6bWFwcyByZWFkOmFjY291bnQgYWRtaW46YWNjb3VudCIsInBlcm1pc3Npb25zIjpbImFkbWluOmFjY291bnQiLCJleGVjdXRlOndvcmtmbG93cyIsInJlYWQ6YWNjb3VudCIsInJlYWQ6YXBwcyIsInJlYWQ6Y29ubmVjdGlvbnMiLCJyZWFkOmN1cnJlbnRfdXNlciIsInJlYWQ6aW1wb3J0cyIsInJlYWQ6bGlzdGVkX2FwcHMiLCJyZWFkOm1hcHMiLCJyZWFkOnRpbGVzZXRzIiwicmVhZDp0b2tlbnMiLCJyZWFkOndvcmtmbG93cyIsInVwZGF0ZTpjdXJyZW50X3VzZXIiLCJ3cml0ZTphcHBzIiwid3JpdGU6Y2FydG8tZHctZ3JhbnRzIiwid3JpdGU6Y29ubmVjdGlvbnMiLCJ3cml0ZTppbXBvcnRzIiwid3JpdGU6bGlzdGVkX2FwcHMiLCJ3cml0ZTptYXBzIiwid3JpdGU6dG9rZW5zIiwid3JpdGU6d29ya2Zsb3dzIl19.XJRQV8Pj8sjHzoi5aqS_ZymALdYuxoq1O3EYd7yVDVYfF3B50waHK8J9FktcGbesTBdj61fcn1iFELwd_E3ZjUlnPOk3vtVy3wXb5NtIsVIAERBPPbSnjHLQwfl_HFH7cwvWJPfwK9BO047JlZoPgZObzQmcpGxeaiqBSgJNajcNUy4KT5oz6WGNaEptAhg019rFj5IVaqkCW7mivE1rt6tDPsPUUJ4Oh_fWuUQWCF0fyMyk7RezTguifqo1GkPuPoAP9zAFpaSxSlk--u5pMhLyDt1F4qKZM54rsU5b2OffLaIf2hUaTQbNc7y1xRuBQL8UP4zBQYmYWXn0LxwnmA';
const hackathonDataset = 'cartodb-on-gcp-backend-team.juanra.historical_aqi_daily'
const devDataset = 'cartobq.testtables.points_10k'


const useStyles = makeStyles((theme) => ({
  controller: {
    position: 'absolute',
    width: 'calc(100vw - 32px)',
    padding: theme.spacing(2)
  }
}))

function Root() {
  const classes = useStyles()
  const [connection, setConnection] = useState('bqconn');

  const interpolator = new LinearInterpolator(['start', 'end']);
  const { layer: torqueLayer, progress, playing, pauseOrResume, setProgress } = useTorque({
    type: MAP_TYPES.TABLE,
    connection,
    credentials: {accessToken, apiBaseUrl},
    data: hackathonDataset,
    formatTiles: 'binary',
    pointRadiusScale: 2,
    pointRadiusMinPixels: 4,
    pointRadiusUnits: 'meters',
    getPointRadius: (d, progress) => {
      const values = d.properties.values.split(',')
      
      return Number(values[progress]) * 100
    },
    // getFillColor: [238, 77, 90],
    getFillColor: (d, progress) => {
      const values = d.properties.values.split(',')
      
      return [Number(values[progress]) * 10, 120, 100]
    },
    lineWidthMinPixels: 0,
    timeseries: {
      column: 'date_local',
      start: '1993-01-10',
      end: '1994-01-10',
      step: 'day',
      propertyColumn: 'arithmetic_mean',
      aggFunction: 'AVG'
    },
    transitions: {
      getPointRadius: 500
    },
    interpolator
  }, ['getPointRadius', 'getFillColor'], {
    steps: 365,
    secondsByStep: 0.2
  })


  const layers = [torqueLayer]
  
  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
        <Map mapLib={maplibregl} mapStyle={MAP_STYLE} />
      </DeckGL>


      <Box width={100}>
        <Paper className={classes.controller}>
          <Box display="flex" alignItems="center">
            <IconButton onClick={pauseOrResume}>
              {playing ? <PauseOutlined/> : <PlayArrowOutlined />}
            </IconButton>
            <Box flex={1}>
              <Slider min={0} max={365} step={1} value={progress} onChange={(d, newValue) => setProgress(newValue)}/>
            </Box>
          </Box>
        </Paper>
      </Box>
    </>
  );
}

const container = document.body.appendChild(document.createElement('div'));
createRoot(container).render(<Root />);
