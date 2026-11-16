-- liquibase formatted sql
-- changeset kirill:02-drop-currency
-- comment: Drop currency column

ALTER TABLE listings
DROP COLUMN currency;