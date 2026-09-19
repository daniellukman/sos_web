// Startup untuk Azure App Service (startup command: node start.js).
// App Service mengisi HOSTNAME dengan nama container, padahal server standalone Next.js
// mendengarkan di HOSTNAME itu. Paksa 0.0.0.0 agar bisa diakses; PORT diisi App Service (8080).
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = process.env.PORT || "8080";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- server.js hasil build Next.js berformat CommonJS
require("./server.js");
