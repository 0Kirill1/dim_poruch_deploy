-- liquibase formatted sql
-- changeset kirill:02-add-foreign-keys
-- comment: Add foreign keys to booking table

ALTER TABLE booking
ADD CONSTRAINT fk_listing_id
FOREIGN KEY (listing_id) REFERENCES listings(id);

ALTER TABLE booking
ADD CONSTRAINT fk_tenant_id
FOREIGN KEY (tenant_id) REFERENCES users(id);