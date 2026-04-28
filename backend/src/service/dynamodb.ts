import { randomUUID } from "crypto";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
  UserRole,
  RetrieveUserFilters,
} from "../types/user";
import type {
  Shipment,
  CreateShipmentInput,
  UpdateShipmentInput,
  ShipmentRetrievalFilters,
} from "../types/shipment";
import type { ShipmentStatus } from "../types/shipment";
import type {
  ShipmentHistoryResponse,
  ShipmentHistoryItem,
} from "../types/history";

// GSI Index Names
export const ROLE_CREATED_INDEX = "role-createdAt-index";
export const SHIPMENT_STATUS_INDEX = "status-updatedAt-index";
export const SHIPMENT_ID_INDEX = "shipmentId-index";

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

interface ShipmentRecord extends Omit<Shipment, "status_"> {
  PK: string;
  SK: string;
  status_: string; // Allow prefixed value
}

interface ShipmentHistoryRecord extends ShipmentHistoryItem {
  PK: string;
  SK: string;
}

export class DynamoDBService {
  constructor(
    private readonly docClient: DocumentClient,
    private readonly userTableName: string,
    private readonly shipmentTableName: string,
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

    await this.docClient
      .put({
        TableName: this.userTableName,
        Item: item as unknown as Record<string, unknown>,
      })
      .promise();

    return user;
  }

  async updateUser(
    user_id: string,
    input: UpdateUserInput,
  ): Promise<User | null> {
    const result = await this.docClient
      .get({
        TableName: this.userTableName,
        Key: {
          PK: `${USER_PREFIX}${user_id}`,
          SK: USER_SK_METADATA,
        },
      })
      .promise();

    const record = result.Item as UserRecord | undefined;
    if (!record) return null;

    const updatedUser: User = {
      ...this.recordToUser(record),
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const item = this.userToRecord(updatedUser);

    await this.docClient
      .put({
        TableName: this.userTableName,
        Item: item as unknown as Record<string, unknown>,
      })
      .promise();
    return updatedUser;
  }

  async deleteUser(user_id: string): Promise<boolean> {
    const result = await this.docClient
      .delete({
        TableName: this.userTableName,
        Key: {
          PK: `${USER_PREFIX}${user_id}`,
          SK: USER_SK_METADATA,
        },
        ReturnValues: "ALL_OLD",
      })
      .promise();
    return !!result.Attributes;
  }

  async getUsers(filters: RetrieveUserFilters): Promise<User[]> {
    const { role, sortOrder } = filters;

    if (!role) {
      throw new Error("role filter is required");
    }

    const params: DocumentClient.QueryInput = {
      TableName: this.userTableName,
      IndexName: ROLE_CREATED_INDEX,
      KeyConditionExpression: "#role = :role",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: { ":role": role },
      ScanIndexForward: sortOrder === "asc", // true for ascending, false for descending
    };

    const result = await this.docClient.query(params).promise();
    return (result.Items as UserRecord[]).map((record) => {
      // Remove PK, SK, rolePk, roleSk before returning as User
      const { PK, SK, rolePk, roleSk, ...user } = record;
      return user as User;
    });
  }

  // Conversion helper: Shipment -> ShipmentRecord (for storage)
  private shipmentToRecord(shipment: Shipment): ShipmentRecord {
    // Accepts a Shipment (status_ is plain) and returns a ShipmentRecord (status_ is prefixed)
    const { status_, ...rest } = shipment;
    return {
      ...rest,
      status_: `${STATUS_PREFIX}${status_}`,
      PK: `${SHIPMENT_PREFIX}${shipment.tracking_number}`,
      SK: SHIPMENT_SK_METADATA,
    };
  }

  // Conversion helper: ShipmentRecord -> Shipment (for business logic)
  private recordToShipment(record: ShipmentRecord): Shipment {
    const { PK, SK, status_, ...rest } = record;
    return {
      ...rest,
      shipment_id: record.shipment_id,
      status_: (status_?.startsWith(STATUS_PREFIX)
        ? status_.slice(STATUS_PREFIX.length)
        : status_) as ShipmentStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      customer_id: record.customer_id,
      customer_name: record.customer_name,
      product_name: record.product_name,
      tracking_number: record.tracking_number,
      origin: record.origin,
      destination: record.destination,
      current_location: record.current_location,
    };
  }
  async createShipment(input: CreateShipmentInput): Promise<Shipment> {
    const timestamp = new Date().toISOString();

    // Accept input.status_ as plain value, store as prefixed
    const shipment: Shipment = {
      shipment_id: randomUUID(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const item = this.shipmentToRecord(shipment);

    // Ensure conditional put to prevent duplicate tracking numbers
    await this.docClient
      .put({
        TableName: this.shipmentTableName,
        Item: item as unknown as Record<string, unknown>,
        ConditionExpression: "attribute_not_exists(PK)",
      })
      .promise();

    return shipment;
  }

  async updateShipment(
    shipment_id: string,
    input: UpdateShipmentInput,
  ): Promise<Shipment | null> {
    // First, query the GSI to find the shipment by shipment_id
    const gsiResult = await this.docClient
      .query({
        TableName: this.shipmentTableName,
        IndexName: SHIPMENT_ID_INDEX,
        KeyConditionExpression: "#sid = :sid",
        ExpressionAttributeNames: { "#sid": "shipment_id" },
        ExpressionAttributeValues: { ":sid": shipment_id },
        Limit: 1,
      })
      .promise();

    const record = (gsiResult.Items as ShipmentRecord[] | undefined)?.[0];
    if (!record) return null;

    // Remove PK, SK, and convert status_ to plain for update
    const currentShipment = this.recordToShipment(record);
    const updatedShipment: Shipment = {
      ...currentShipment,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const item = this.shipmentToRecord(updatedShipment);

    await this.docClient
      .put({
        TableName: this.shipmentTableName,
        Item: item as unknown as Record<string, unknown>,
      })
      .promise();

    return updatedShipment;
  }

  //admin control shipment sorting by status
  async getShipments(filters: ShipmentRetrievalFilters): Promise<Shipment[]> {
    const { status_, sortOrder } = filters;

    if (!status_) {
      throw new Error("status_ filter is required");
    }

    const params: DocumentClient.QueryInput = {
      TableName: this.shipmentTableName,
      IndexName: SHIPMENT_STATUS_INDEX,
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status_" },
      ExpressionAttributeValues: { ":status": `${STATUS_PREFIX}${status_}` }, // Add prefix here
      ScanIndexForward: sortOrder === "asc",
    };

    const result = await this.docClient.query(params).promise();
    return (result.Items as ShipmentRecord[]).map((record) =>
      this.recordToShipment(record),
    );
  }

  //user control, get 1 shipment per tracking number
  async getShipmentByTrackingNumber(tracking_number: string): Promise<Shipment | null> {
    // Get the shipment directly using the main table PK (tracking_number)
    const result = await this.docClient
      .get({
        TableName: this.shipmentTableName,
        Key: {
          PK: `${SHIPMENT_PREFIX}${tracking_number}`,
          SK: SHIPMENT_SK_METADATA,
        },
      })
      .promise();

    const record = result.Item as ShipmentRecord | undefined;
    return record ? this.recordToShipment(record) : null;
  }
  
  private historyToRecord(item: ShipmentHistoryItem): ShipmentHistoryRecord {
    return {
      ...item,
      PK: `${SHIPMENT_PREFIX}${item.tracking_number}`,
      SK: `${SHIPMENT_SK_EVENT}${item.historyId}`,
    };
  }

  private recordToHistory(record: ShipmentHistoryRecord): ShipmentHistoryItem {
    const { PK, SK, ...rest } = record;
    return rest as ShipmentHistoryItem;
  }

  private recordToHistoryResponse(record: ShipmentHistoryRecord): ShipmentHistoryResponse {
    const { PK, SK, admin_verified, verifiedAt, verifiedBy, ...rest } = record;
    return rest as ShipmentHistoryResponse;
  }

  async createShipmentHistory(input: Omit<ShipmentHistoryItem, "historyId" | "historyAt"> & Partial<Pick<ShipmentHistoryItem, "historyId" | "historyAt">>): Promise<ShipmentHistoryItem> {
    const historyId = input.historyId ?? randomUUID();
    const historyAt = input.historyAt ?? new Date().toISOString();

    const item: ShipmentHistoryItem = {
      ...input,
      historyId,
      historyAt,
    };

    const record = this.historyToRecord(item);

    // Ensure conditional put to prevent duplicate history IDs under the same PK
    await this.docClient
      .put({
        TableName: this.shipmentTableName,
        Item: record as unknown as Record<string, unknown>,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
      .promise();

    return item;
  }

  async getShipmentHistory(tracking_number: string): Promise<ShipmentHistoryItem[]> {
    const result = await this.docClient
      .query({
        TableName: this.shipmentTableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `${SHIPMENT_PREFIX}${tracking_number}`,
          ":skPrefix": SHIPMENT_SK_EVENT,
        },
      })
      .promise();

    return ((result.Items as ShipmentHistoryRecord[]) ?? []).map((r) => this.recordToHistory(r));
  }
  
  async getShipmentHistoryForUser(tracking_number: string): Promise<ShipmentHistoryResponse[]> {
    const result = await this.docClient
      .query({
        TableName: this.shipmentTableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `${SHIPMENT_PREFIX}${tracking_number}`,
          ":skPrefix": SHIPMENT_SK_EVENT,
        },
      })
      .promise();

    return ((result.Items as ShipmentHistoryRecord[]) ?? []).map((r) => this.recordToHistoryResponse(r));
  }
}
