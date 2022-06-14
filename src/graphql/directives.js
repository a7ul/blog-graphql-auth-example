import { ForbiddenError } from "apollo-server-express";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import { RolePermissions } from "./roles.js";
import { defaultFieldResolver } from "graphql";

function isAuthorized(fieldPermissions, typePermissions, user) {
  const userRoles = user?.roles ?? [];
  // Add self:anyone to user permissions by default
  const userPermissions = new Set(["self:anyone"]);
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

  // 3. if there are no field permissions then check if the type has permissions
  if (fieldPermissions.length === 0) {
    for (const typePermission of typePermissions) {
      if (userPermissions.has(typePermission)) {
        return true;
      }
    }
  }
  return false;
}

function gatherTypePermissions(schema) {
  // 1. Create a map to store a type and its permissions
  const typePermissionMapping = new Map();
  mapSchema(schema, {
    // 2. Executes once for each type definition in the schema
    [MapperKind.OBJECT_TYPE]: (typeConfig) => {
      const typeAuthDirective = getDirective(schema, typeConfig, "auth")?.[0];
      const typeLevelPermissions = typeAuthDirective?.permissions ?? [];
      // 3. Collect permissions for each type
      typePermissionMapping.set(typeConfig.name, typeLevelPermissions);
      return typeConfig;
    },
  });
  return typePermissionMapping;
}

function shouldDenyFieldByDefault(
  fieldPermissions,
  typePermissions,
  fieldName,
  typeName
) {
  if (fieldName.startsWith("_") || typeName.startsWith("_")) {
    // Apollo's internal fields / types start with _
    return false;
  }
  const hasNoPermissions =
    fieldPermissions.length === 0 && typePermissions.length === 0;
  return hasNoPermissions;
}

export function getAuthorizedSchema(schema) {
  const typePermissionMapping = gatherTypePermissions(schema);

  const authorizedSchema = mapSchema(schema, {
    // Executes once for each object field definition in the schema
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
      // 1. Try to get the @auth directive config on the field
      const fieldAuthDirective = getDirective(schema, fieldConfig, "auth")?.[0];
      // 1.1 Get the permissions for the field
      const fieldPermissions = fieldAuthDirective?.permissions ?? [];
      // 1.2 Get the permissions for the field's type
      const typePermissions = typePermissionMapping.get(typeName) ?? [];

      // 1.3 Check if field should be denied by default
      if (
        shouldDenyFieldByDefault(
          fieldPermissions,
          typePermissions,
          fieldName,
          typeName
        )
      ) {
        // Replace, the resolver with a ForbiddenError throwing function.
        // Optionally log here so it shows up while the server starts
        fieldConfig.resolve = () => {
          throw new ForbiddenError(
            `No access control specified for ${typeName}.${fieldName}. Deny by default`
          );
        };
        return fieldConfig;
      }

      // 2. If a @auth directive is found, replace the field's resolver with a custom resolver
      if (fieldPermissions.length > 0 || typePermissions.length > 0) {
        // 2.1. Get the original resolver on the field
        const originalResolver = fieldConfig.resolve ?? defaultFieldResolver;
        // 2.2. Replace the field's resolver with a custom resolver
        fieldConfig.resolve = (source, args, context, info) => {
          const user = context.user;
          if (!isAuthorized(fieldPermissions, typePermissions, user)) {
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
