import fs from "node:fs";
import { ApolloServer, gql } from "apollo-server-express";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { resolvers } from "./resolvers.js";
import { getAuthorizedSchema } from "./directives.js";

const schemaFilePath = new URL("schema.graphql", import.meta.url);

const typeDefs = gql(fs.readFileSync(schemaFilePath, "utf8"));

export async function createApolloServer() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const authorizedSchema = getAuthorizedSchema(schema);

  const server = new ApolloServer({
    schema: authorizedSchema,
    context: ({ req }) => ({
      user: req.auth,
    }),
  });

  await server.start();
  return server;
}
