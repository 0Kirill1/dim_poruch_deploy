-- liquibase formatted sql
-- changeset kirill:02-unique-email
-- comment: Set unique to email

ALTER TABLE users
ADD CONSTRAINT unique_email UNIQUE (email);