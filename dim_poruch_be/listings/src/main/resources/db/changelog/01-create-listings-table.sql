-- liquibase formatted sql
-- changeset kirill:01-create-listings-table
-- comment: Creating listings table

CREATE TABLE IF NOT EXISTS listings(
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    monthly_price NUMERIC(12,2) NOT NULL,
    currency CHAR(3) DEFAULT 'UAH',
    rooms SMALLINT NOT NULL,
    area NUMERIC(8,2),
    property_type VARCHAR(30) NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_listing_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_listings_owner_id ON listings(owner_id);
CREATE INDEX idx_listings_city_status_rooms ON listings(city, monthly_price, rooms);
CREATE INDEX idx_listings_active_search
    ON listings(city, monthly_price)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);