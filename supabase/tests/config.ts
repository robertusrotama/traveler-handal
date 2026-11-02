/**
 * TEST_DATABASE_URL — koneksi superuser ke database apa saja di server Postgres 15+ target.
 * Default: postgres://postgres:postgres@localhost:5432/postgres.
 * Setiap `pnpm test:db` membuat database baru `th_test_<acak>` di server itu lalu menghapusnya.
 */
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
