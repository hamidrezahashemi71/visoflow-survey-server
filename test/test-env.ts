// Integration tests run against a dedicated Postgres *schema* (`viso_test`) in
// the local dev database, so they never touch dev data. The schema + tables are
// created by test/global-setup.ts before the suite runs.
export const TEST_SCHEMA = "viso_test";
export const TEST_DATABASE_URL = `postgresql://viso:viso_dev_password@localhost:5432/viso?schema=${TEST_SCHEMA}`;
export const ADMIN_API_KEY = "test_admin_key_0123456789";
export const IP_HASH_SALT = "test_ip_hash_salt_0123456789";
