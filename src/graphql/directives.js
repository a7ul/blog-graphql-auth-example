import { ForbiddenError } from "apollo-server-express";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import { RolePermissions } from "./roles.js";
import { defaultFieldResolver } from "graphql";

function isAuthorized(fieldPermissions, user) {
  const userRoles = user?.roles ?? [];
  const userPermissions = new Set();
  // 1. Expand user roles to permissions
  userRoles.forEach((roleKey) => {
    const role = RolePermissions[roleKey] ?? RolePermissions.anonymous;
    role.permissions?.forEach((permission) => userPermissions.add(permission));
  });

  // 2. Check if atleast one of the user's permissions matches that of required for accessing the field
  for (const permission of fieldPermissions) {
    if (userPermissions.has(permission)) {
      return true;
    }
  }
  return false;
}

export function getAuthorizedSchema(schema) {
  const authorizedSchema = mapSchema(schema, {
    // Executes once for each object field definition in the schema
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      // 1. Try to get the @auth directive config on the field
      const fieldAuthDirective = getDirective(schema, fieldConfig, "auth")?.[0];

      // 2. If a @auth directive is found, replace the field's resolver with a custom resolver
      if (fieldAuthDirective) {
        // 2.1. Get the original resolver on the field
        const originalResolver = fieldConfig.resolve ?? defaultFieldResolver;
        // 2.2. Replace the field's resolver with a custom resolver
        fieldConfig.resolve = (source, args, context, info) => {
          const user = context.user;
          const fieldPermissions = fieldAuthDirective.permissions;
          if (!isAuthorized(fieldPermissions, user)) {
            // 2.3 If the user doesn't have the required permissions, throw an error
            throw new ForbiddenError("Unauthorized");
          }
          // 2.4 Otherwise call the original resolver and return the result
          return originalResolver(source, args, context, info);
        };
      }
      return fieldConfig;
    },
  });
  return authorizedSchema;
}