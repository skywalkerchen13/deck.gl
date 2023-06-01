import {defineConfig} from 'vite';
import {getOcularConfig} from 'ocular-dev-tools';
import {join} from 'path';
import zlib from 'zlib';

const rootDir = join(__dirname, '..');
const CACHE_CONTROL = 'public,max-age=100000,must-revalidate';

// Rewrite URLs in instantiation & tilejson response to use our endpoint
const writeBody = (buffer, res, proxyRes) => {
  let remoteBody = buffer.toString();
  const isMapInstantiation = remoteBody.includes('nrows');
  const endpoint = isMapInstantiation ? 'carto-api' : 'carto-data-api';
  remoteBody = remoteBody.replace(
    'https://gcp-us-east1.api.carto.com/',
    `http://localhost:8080/${endpoint}/`
  ); // Point at non-selfHandleResponse endpoint

  delete proxyRes.headers['content-encoding'];
  delete proxyRes.headers['content-length'];
  res.writeHead(proxyRes.statusCode, proxyRes.headers);
  res.write(remoteBody);
  res.end();
};

/** https://vitejs.dev/config/ */
export default defineConfig(async () => {
  const {aliases} = await getOcularConfig({root: rootDir});

  return {
    resolve: {
      alias: {
        ...aliases,
        // Use root dependencies
        '@luma.gl': join(rootDir, './node_modules/@luma.gl'),
        '@math.gl': join(rootDir, './node_modules/@math.gl'),
        '@loaders.gl/core': join(rootDir, './node_modules/@loaders.gl/core')
      }
    },
    define: {
      'process.env.GoogleMapsAPIKey': JSON.stringify(process.env.GoogleMapsAPIKey),
      'process.env.GoogleMapsMapId': JSON.stringify(process.env.GoogleMapsMapId),
      'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken)
    },
    server: {
      open: true,
      port: 8080,
      proxy: {
        '/carto-api': {
          target: 'https://gcp-us-east1.api.carto.com',
          selfHandleResponse: true,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/carto-api/, ''),
          configure: proxy => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['cache-control'] = CACHE_CONTROL;

              // Modify response for tilejson to update URLs
              let body = [];

              proxyRes.on('data', function (chunk) {
                body.push(chunk);
              });
              proxyRes.on('end', function () {
                body = Buffer.concat(body);

                if (proxyRes.headers['content-encoding']) {
                  zlib.unzip(body, (err, buffer) => {
                    if (!err) {
                      writeBody(buffer, res, proxyRes);
                    } else {
                      console.error(err);
                    }
                  });
                } else {
                  writeBody(body, res, proxyRes);
                }
              });
            });
          }
        },
        '/carto-data-api': {
          target: 'https://gcp-us-east1.api.carto.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/carto-data-api/, ''),
          configure: proxy => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['cache-control'] = CACHE_CONTROL;
            });
          }
        }
      }
    },
    optimizeDeps: {
      esbuildOptions: {target: 'es2020'}
    }
  };
});
