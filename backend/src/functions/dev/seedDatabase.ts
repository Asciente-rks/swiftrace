import "dotenv/config";
import { DynamoDB } from "aws-sdk";
import { DynamoDBService } from "../../service/dynamodb";
import { getTableName } from "../../utils/env";

const docClient = new DynamoDB.DocumentClient();
const tableName = getTableName();

const service = new DynamoDBService(docClient, tableName, tableName);

export const handler = async () => {
  try {
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
        await service.createUser(user);
        console.log(`Created user: ${user.email}`);
      } catch (error) {
        console.error(`Error with user ${user.email}:`, error);
        throw error;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Database seeded successfully with test accounts",
        users: [
          "admin@swiftrace.com",
          "shipper@swiftrace.com",
          "customer@swiftrace.com",
        ],
      }),
    };
  } catch (error) {
    console.error("Seeding failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to seed database",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
