-- liquibase formatted sql
-- changeset kirill:04-add-role-to-users
-- comment: Add role column to users table

ALTER TABLE users
    ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'TENANT';