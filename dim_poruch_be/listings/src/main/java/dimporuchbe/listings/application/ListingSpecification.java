package dimporuchbe.listings.application;

import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.PropertyType;
import dimporuchbe.listings.persistence.Status;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;

public class ListingSpecification {

    public static Specification<Listing> hasCity(String city){
        return (root, query, cb) ->
                city == null || city.isBlank() ? null : cb.equal(cb.lower(root.get("city")), city.toLowerCase());
    }

    public static Specification<Listing> priceBetween(BigDecimal minPrice, BigDecimal maxPrice){
        return (root, query, cb) -> {
            if (minPrice == null && maxPrice == null) return null;
            if (minPrice != null && maxPrice != null) {
                return cb.between(root.get("monthlyPrice"), minPrice, maxPrice);
            }
            if (minPrice != null) {
                return cb.greaterThanOrEqualTo(root.get("monthlyPrice"), minPrice);
            }
            return cb.lessThanOrEqualTo(root.get("monthlyPrice"), maxPrice);
        };
    }

    public static Specification<Listing> hasRooms(Short rooms){
        return (root, query, cb) ->
                rooms == null ? null : cb.equal(root.get("rooms"), rooms);
    }

    public static Specification<Listing> hasStatus(Status status){
        return (root, query, cb) ->
                status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<Listing> hasPropertyType(PropertyType propertyType){
        return (root, query, cb) ->
                propertyType == null ? null : cb.equal(root.get("propertyType"), propertyType);
    }

    public static Specification<Listing> hasAmenity(String amenity){
        return (root, query, cb) -> {
            if (amenity == null || amenity.isBlank()) return null;
            return cb.isMember(amenity, root.get("amenities"));
        };
    }
}
