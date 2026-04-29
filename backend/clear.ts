/// <reference types="node" />
import "dotenv/config";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();
const tableName = process.env.LOGISTICS_DYNAMO_TABLE || "swiftrace-logistics-dev";

const seededEmails = ["admin@swiftrace.com", "shipper@swiftrace.com", "customer@swiftrace.com"];

const clearDatabase = async () => {
  const scanParams = {
    TableName: tableName,
  };

  let itemsToDelete: { PK: string; SK: string }[] = [];

  let lastEvaluatedKey;
  do {
    const result = await docClient.scan({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    }).promise();

    for (const item of result.Items || []) {
      const pk = item.PK as string;
      const sk = item.SK as string;
      if (pk.startsWith("USER#") && sk === "METADATA") {
        const email = item.email as string;
        if (!seededEmails.includes(email)) {
          itemsToDelete.push({ PK: pk, SK: sk });
        }
      } else {
        // Delete shipments and history
        itemsToDelete.push({ PK: pk, SK: sk });
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Delete the items
  for (const key of itemsToDelete) {
    await docClient.delete({
      TableName: tableName,
      Key: key,
    }).promise();
    console.log(`Deleted item: ${key.PK} ${key.SK}`);
  }

  console.log(`Cleared ${itemsToDelete.length} items, retained seeded users.`);
};

clearDatabase().catch(console.error);