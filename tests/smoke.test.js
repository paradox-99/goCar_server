const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');

const doRequest = (path) =>
     new Promise((resolve, reject) => {
          const server = app.listen(0, () => {
               const { port } = server.address();
               http.get(`http://127.0.0.1:${port}${path}`, (res) => {
                    server.close();
                    resolve(res.statusCode);
               }).on('error', (error) => {
                    server.close();
                    reject(error);
               });
          });
     });

test('api route table is mounted', async () => {
     const statusCode = await doRequest('/api/carRoutes/showAllCars');
     assert.equal([200, 500].includes(statusCode), true);
});

test('missing route returns 404', async () => {
     const statusCode = await doRequest('/definitely-not-a-real-route');
     assert.equal(statusCode, 404);
});
