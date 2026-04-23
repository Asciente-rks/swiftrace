import { randomUUID } from "crypto";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import type { User, CreateUserInput, UpdateUserInput, UserRole } from "../types/user";
import type { Shipment, CreateShipmentInput, UpdateShipmentInput, ShipmentRetrievalFilters } from "../types/shipment";
import type { ShipmentHistoryType, ShipmentHistoryItem } from "../types/history";

// GSI Index Names
export const ROLE_CREATED_INDEX = "role-createdAt-index";
export const SHIPMENT_STATUS_INDEX = "status-updatedAt-index";

// GSI Key Prefixes
export const ROLE_PREFIX = "ROLE#"; // GSI 1 PK
export const STATUS_PREFIX = "STATUS#"; // GSI 2 PK

// Main Table PK/SK Prefixes
export const SHIPMENT_PREFIX = "SHIPMENT#"; // PK for shipments
export const SHIPMENT_SK_METADATA = "METADATA"; // SK for shipment metadata
export const SHIPMENT_SK_EVENT = "EVENT#"; // SK for shipment events/history

export const USER_PREFIX = "USER#"; // PK for users
export const USER_SK_METADATA = "METADATA"; // SK for user metadata

// DynamoDB storage shape for users
interface UserRecord extends User {
  PK: string;
  SK: string;
  rolePk: string;
  roleSk: string;
}

export class DynamoDBService {
  constructor (
    private readonly docClient: DocumentClient,
    private readonly userTableName: string,
  ) {}

  // Conversion helper: User -> UserRecord
  private userToRecord(user: User): UserRecord {
    return {
      ...user,
      PK: `${USER_PREFIX}${user.user_id}`,
      SK: USER_SK_METADATA,
      rolePk: `${ROLE_PREFIX}${user.role}`,
      roleSk: user.createdAt,
    };
  }

  // Conversion helper: UserRecord -> User (if needed in the future)
  private recordToUser(record: UserRecord): User {
    const { PK, SK, rolePk, roleSk, ...user } = record;
    return user as User;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const timestamp = new Date().toISOString();

    const role: UserRole = input.role ?? "customer";

    const user: User = {
      user_id: randomUUID(),
      ...input,
      role,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const item = this.userToRecord(user);

    await this.docClient.put({
      TableName: this.userTableName,
      Item: item as unknown as Record<string, unknown>,
    }).promise();

    return user;
  }

  async updateUser(user_id: string, input: UpdateUserInput): Promise<User | null> {
    const result = await this.docClient.get({
    TableName: this.userTableName,
    Key: {
      PK: `${USER_PREFIX}${user_id}`,
      SK: USER_SK_METADATA,
      },
    }).promise();

    const record = result.Item as UserRecord | undefined;
    if (!record) return null;

    const updatedUser: User = {
      ...this.recordToUser(record),
      ...input,
      updatedAt: new Date().toISOString(),
    }

    const item = this.userToRecord(updatedUser);

    await this.docClient.put({
      TableName: this.userTableName,
      Item: item as unknown as Record<string, unknown>,
    }).promise();
    return updatedUser;
  }

  async deleteUser(user_id: string): Promise<boolean> {
    const result = await this.docClient.delete({
      TableName: this.userTableName,
      Key: {
        PK: `${USER_PREFIX}${user_id}`,
        SK: USER_SK_METADATA,
      },
    ReturnValues: "ALL_OLD",
    }).promise();
    return !!result.Attributes;
  }
}