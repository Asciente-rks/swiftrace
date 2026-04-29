export function getTableName(): string {
  const tableName =
    process.env.LOGISTICS_DYNAMO_TABLE ?? process.env.SHIPMENT_DYNAMO_TABLE;

  if (!tableName) {
    const err: any = new Error(
      "LOGISTICS_DYNAMO_TABLE environment variable is not set."
    );
    err.statusCode = 500;
    throw err;
  }

  return tableName;
}
