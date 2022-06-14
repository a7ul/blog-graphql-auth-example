import jwt from "jsonwebtoken";
import { UserInputError } from "apollo-server-express";
import { Users } from "../models/users.js";
import { JWT_SECRET } from "../config.js";
import { Invoices } from "../models/invoices.js";

export const resolvers = {
  Mutation: {
    login: (_, { username }) => {
      const user = Users.find((user) => user.username === username);
      if (!user) {
        throw new UserInputError("User not found");
      }
      const token = jwt.sign({ id: user.id, roles: user.roles }, JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: "10m",
      });
      return { token };
    },
    updateCustomer: (_, { customerId, name }) => {
      const customer = Users.find(
        (user) => user.id === customerId && user.type === "customer"
      );
      if (!customer) {
        throw new UserInputError("User not found");
      }
      customer.name = name;
      return customer;
    },
    updateEmployeeRole: (_, { employeeId, role }) => {
      const employee = Users.find(
        (user) => user.id === employeeId && user.type === "employee"
      );
      if (!employee) {
        throw new UserInputError("User not found");
      }
      employee.roles.push(role);
      return true;
    },
  },
  Query: {
    health: () => "OK",
    me: (root, args, context) => {
      const id = context.user.id;
      return Users.find((user) => user.id === id && user.type === "customer");
    },
    customers: () => {
      return Users.filter((user) => user.type === "customer");
    },
    getCustomerInvoices(root, args) {
      const customerId = args.customerId;
      const invoices = Invoices.filter(
        (invoice) => invoice.customerId === customerId
      );
      return invoices;
    },
  },
  Customer: {
    invoices: (customer) => {
      const invoices = Invoices.filter(
        (invoice) => invoice.customerId === customer.id
      );
      return invoices;
    },
  },
};
