import express from "express";
import { expressjwt } from "express-jwt";
import { createApolloServer } from "./graphql/index.js";
import { JWT_SECRET } from "./config.js";

async function createApp() {
  const app = express();

  app.use(
    expressjwt({
      secret: JWT_SECRET,
      algorithms: ["HS256"],
      credentialsRequired: false,
    })
  );

  const server = await createApolloServer();
  server.applyMiddleware({ app });

  return app;
}

const app = await createApp();

app.listen({ port: 3000 }, () =>
  console.log(`🚀 Server ready at http://localhost:3000/graphql`)
);
