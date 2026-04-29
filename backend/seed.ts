import "dotenv/config";
import { DynamoDB } from "aws-sdk";
import { DynamoDBService } from "./src/service/dynamodb";
import { getTableName } from "./src/utils/env";

const docClient = new DynamoDB.DocumentClient();
const tableName = getTableName();

const service = new DynamoDBService(docClient, tableName, tableName);

const seedUsers = async () => {
  const users = [
    {
      name: "Admin User",
      email: "admin@swiftrace.com",
      password: "admin123",
      role: "admin" as const,
      verification_status: "verified" as const,
    },
    {
      name: "Shipper User",
      email: "shipper@swiftrace.com",
      password: "shipper123",
      role: "shipper" as const,
      verification_status: "verified" as const,
    },
    {
      name: "Customer User",
      email: "customer@swiftrace.com",
      password: "customer123",
      role: "customer" as const,
      verification_status: "verified" as const,
    },
  ];

  for (const user of users) {
    try {
      // Delete existing users with the same email
      const existingUsers = await service.scanUsersByEmail(user.email);
      for (const existing of existingUsers) {
        await service.deleteUser(existing.user_id);
        console.log(`Deleted existing user: ${existing.email}`);
      }
      const created = await service.createUser(user);
      console.log(`Created user: ${created.email}`);
    } catch (error) {
      console.error(`Error with user ${user.email}:`, error);
    }
  }
};

seedUsers().catch(console.error);