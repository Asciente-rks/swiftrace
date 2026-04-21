import { randomUUID } from "crypto";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import {
  Shipment,
  CreateShipmentInput,
  UpdateShipmentInput,
  ShipmentRetrievalFilters,
} from "../types/shipment";
import {
  User,
  CreateUserInput,
  UpdateUserInput,
  RetrieveUserFilters,
  UserRole,
} from "../types/user";

const ROLE_CREATED_INDEX = "role-createdAt-index";
const SHIPMENT_STATUS_INDEX = "status-updatedAt-index";

const SHIPMENT_PREFIX = "SHIPMENT#";
const SHIPMENT_SK_METADATA = "METADATA";
const SHIPMENT_SK_EVENT = "EVENT#";

const USER_PREFIX = "USER#";
const ROLE_PREFIX = "ROLE#";
const STATUS_PREFIX = "STATUS#";

type UserRecord = User & {
  PK: string;
  SK: string;
  rolePk: string;
  roleSk: string;
};

type ShipmentRecord = Shipment & {
  PK: string;
  SK: string;
  statusPk: string;
  statusSk: string;
};

export class DynamoDBService {
  constructor(
    private readonly docClient: DocumentClient,
    private readonly tableName: string
  ) {}

  private toIsoDate(): string {
    return new Date().toISOString();
  }

  private userToRecord(user: User): UserRecord {
    return {
      ...user,
      PK: `${USER_PREFIX}${user.user_id}`,
      SK: "METADATA",
      rolePk: `${ROLE_PREFIX}${user.role}`,
      roleSk: user.createdAt,
    };
  }

  private recordToUser(record: UserRecord): User {
    const { PK, SK, rolePk, roleSk, ...user } = record;
    return user as User;
  }

  private shipmentToRecord(shipment: Shipment): ShipmentRecord {
    return {
      ...shipment,
      PK: `${SHIPMENT_PREFIX}${shipment.tracking_number}`,
      SK: SHIPMENT_SK_METADATA,
      statusPk: `${STATUS_PREFIX}${shipment.status_}`,
      statusSk: shipment.updatedAt,
    };
  }

  private recordToShipment(record: ShipmentRecord): Shipment {
    const { PK, SK, statusPk, statusSk, ...shipment } = record;
    return shipment as Shipment;
  }

  // ---------- User methods ----------
  async createUser(
    input: CreateUserInput,
    options?: { createdAt?: string }
  ): Promise<User> {
    const createdAt = options?.createdAt ?? this.toIsoDate();
    const user: User = {
      user_id: randomUUID(),
      ...input,
      createdAt,
      updatedAt: createdAt,
    };

    const record = this.userToRecord(user);
    await this.docClient
      .put({
        TableName: this.tableName,
        Item: record as unknown as DocumentClient.PutItemInputAttributeMap,
      })
      .promise();

    return user;
  }

  async getUserById(user_id: string): Promise<User | null> {
    const result = await this.docClient
      .get({
        TableName: this.tableName,
        Key: {
          PK: `${USER_PREFIX}${user_id}`,
          SK: "METADATA",
        },
      })
      .promise();

    const item = result.Item as UserRecord | undefined;
    return item ? this.recordToUser(item) : null;
  }

  async listUsersByRole(
    role: UserRole,
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<User[]> {
    const result = await this.docClient
      .query({
        TableName: this.tableName,
        IndexName: ROLE_CREATED_INDEX,
        KeyConditionExpression: "rolePk = :rolePk",
        ExpressionAttributeValues: {
          ":rolePk": `${ROLE_PREFIX}${role}`,
        },
        ScanIndexForward: sortOrder === "asc",
      })
      .promise();

    return ((result.Items as UserRecord[]) ?? []).map((r) =>
      this.recordToUser(r)
    );
  }

  async updateUser(
    user_id: string,
    input: UpdateUserInput
  ): Promise<User | null> {
    const existing = await this.getUserById(user_id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...input,
      user_id,
      createdAt: existing.createdAt,
      updatedAt: this.toIsoDate(),
    };

    const record = this.userToRecord(updated);
    await this.docClient
      .put({
        TableName: this.tableName,
        Item: record as unknown as DocumentClient.PutItemInputAttributeMap,
      })
      .promise();

    return updated;
  }

  // ---------- Shipment methods ----------
  async createShipment(
    input: CreateShipmentInput,
    options?: { createdAt?: string; updatedAt?: string }
  ): Promise<Shipment> {
    const createdAt = options?.createdAt ?? this.toIsoDate();
    const updatedAt = options?.updatedAt ?? createdAt;

    const shipment: Shipment = {
      ...input,
      createdAt,
      updatedAt,
    };

    const record = this.shipmentToRecord(shipment);
    await this.docClient
      .put({
        TableName: this.tableName,
        Item: record as unknown as DocumentClient.PutItemInputAttributeMap,
      })
      .promise();

    return shipment;
  }

  async getShipmentByTracking(
    tracking_number: string
  ): Promise<Shipment | null> {
    const result = await this.docClient
      .get({
        TableName: this.tableName,
        Key: {
          PK: `${SHIPMENT_PREFIX}${tracking_number}`,
          SK: SHIPMENT_SK_METADATA,
        },
      })
      .promise();

    const item = result.Item as ShipmentRecord | undefined;
    return item ? this.recordToShipment(item) : null;
  }

  async listShipmentsByStatus(
    status_: string,
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<Shipment[]> {
    const result = await this.docClient
      .query({
        TableName: this.tableName,
        IndexName: SHIPMENT_STATUS_INDEX,
        KeyConditionExpression: "statusPk = :statusPk",
        ExpressionAttributeValues: {
          ":statusPk": `${STATUS_PREFIX}${status_}`,
        },
        ScanIndexForward: sortOrder === "asc",
      })
      .promise();

    return ((result.Items as ShipmentRecord[]) ?? []).map((r) =>
      this.recordToShipment(r)
    );
  }

  async updateShipment(
    tracking_number: string,
    input: UpdateShipmentInput
  ): Promise<Shipment | null> {
    const existing = await this.getShipmentByTracking(tracking_number);
    if (!existing) return null;

    const updated: Shipment = {
      ...existing,
      ...input,
      tracking_number,
      createdAt: existing.createdAt,
      updatedAt: this.toIsoDate(),
    };

    const record = this.shipmentToRecord(updated);
    await this.docClient
      .put({
        TableName: this.tableName,
        Item: record as unknown as DocumentClient.PutItemInputAttributeMap,
      })
      .promise();

    return updated;
  }

  async addShipmentEvent(
    tracking_number: string,
    event: {
      event_id: string;
      event_type: string;
      event_data?: unknown;
      occurredAt?: string;
    }
  ): Promise<void> {
    const occurredAt = event.occurredAt ?? this.toIsoDate();
    const eventSk = `${SHIPMENT_SK_EVENT}${occurredAt}#${event.event_id}`;

    await this.docClient
      .put({
        TableName: this.tableName,
        Item: {
          PK: `${SHIPMENT_PREFIX}${tracking_number}`,
          SK: eventSk,
          event_type: event.event_type,
          event_data: event.event_data,
          occurredAt,
        },
      })
      .promise();
  }

  async getShipmentHistory(
    tracking_number: string
  ): Promise<ShipmentRecord[]> {
    const result = await this.docClient
      .query({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `${SHIPMENT_PREFIX}${tracking_number}`,
          ":skPrefix": SHIPMENT_SK_EVENT,
        },
      })
      .promise();

    return ((result.Items as ShipmentRecord[]) ?? []).map((item) => item);
  }

  async retrieveShipments(
    filters?: ShipmentRetrievalFilters
  ): Promise<Shipment[]> {
    if (filters?.status_ != null) {
      return this.listShipmentsByStatus(filters.status_);
    }

    throw new Error(
      "retrieveShipments currently supports only status_ filtering"
    );
  }
}

export function createDynamoDBService(
  docClient: DocumentClient,
  tableName: string
): DynamoDBService {
  return new DynamoDBService(docClient, tableName);
}