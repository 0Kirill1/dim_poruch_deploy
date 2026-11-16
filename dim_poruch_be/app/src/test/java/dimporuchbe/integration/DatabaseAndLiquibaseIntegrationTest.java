package dimporuchbe.integration;

import dimporuchbe.bookings.persistence.Booking;
import dimporuchbe.bookings.persistence.BookingRepository;
import dimporuchbe.bookings.persistence.BookingStatus;
import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.api.dtos.ListingSearchDto;
import dimporuchbe.listings.application.ListingService;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.listings.persistence.PropertyType;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.user.persistence.Role;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import dimporuchbe.dim_poruch_be.DimPoruchBeApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = DimPoruchBeApplication.class)
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class DatabaseAndLiquibaseIntegrationTest {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("dim_poruch_be_test")
            .withUsername("dim_poruch_test")
            .withPassword("dim_poruch_test");

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ListingService listingService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("app.storage.listings-path", () -> "target/test-uploads");
    }

    @Test
    void bookingOverlapQueryTreatsApprovedAndActiveBookingsAsBlocking() {
        User tenant = saveUser("tenant-overlap@example.com", Role.TENANT);
        Listing listing = saveListing(tenant, Status.ACTIVE, "Kyiv", BigDecimal.valueOf(1200), Set.of("wifi"));
        LocalDate existingStart = LocalDate.of(2027, 1, 10);
        LocalDate existingEnd = LocalDate.of(2027, 1, 20);

        saveBooking(listing, tenant, existingStart, existingEnd, BookingStatus.APPROVED);

        assertThat(bookingRepository.existsOverLappingBooking(
                listing.getId(),
                LocalDate.of(2027, 1, 15),
                LocalDate.of(2027, 1, 25)
        )).isTrue();

        assertThat(bookingRepository.existsOverLappingBooking(
                listing.getId(),
                existingEnd,
                LocalDate.of(2027, 1, 25)
        )).isFalse();

        Listing activeBookingListing = saveListing(
                tenant, Status.ACTIVE, "Kyiv", BigDecimal.valueOf(1300), Set.of());
        saveBooking(
                activeBookingListing,
                tenant,
                LocalDate.of(2027, 1, 10),
                LocalDate.of(2027, 1, 20),
                BookingStatus.ACTIVE
        );

        assertThat(bookingRepository.existsOverLappingBooking(
                activeBookingListing.getId(),
                LocalDate.of(2027, 1, 15),
                LocalDate.of(2027, 1, 25)
        )).isTrue();
    }

    @Test
    void bookingOverlapQueryIgnoresNonBlockingStatuses() {
        User tenant = saveUser("tenant-pending@example.com", Role.TENANT);
        Listing listing = saveListing(tenant, Status.ACTIVE, "Kyiv", BigDecimal.valueOf(1200), Set.of());

        saveBooking(
                listing,
                tenant,
                LocalDate.of(2027, 2, 10),
                LocalDate.of(2027, 2, 20),
                BookingStatus.PENDING
        );

        assertThat(bookingRepository.existsOverLappingBooking(
                listing.getId(),
                LocalDate.of(2027, 2, 12),
                LocalDate.of(2027, 2, 18)
        )).isFalse();
    }

    @Test
    void futureBookingsQueryFiltersStatusAndOrdersByStartDate() {
        User tenant = saveUser("tenant-future@example.com", Role.TENANT);
        Listing listing = saveListing(tenant, Status.ACTIVE, "Kyiv", BigDecimal.valueOf(1200), Set.of());
        LocalDate today = LocalDate.of(2027, 3, 10);

        Booking endingToday = saveBooking(
                listing, tenant, LocalDate.of(2027, 3, 1), today, BookingStatus.ACTIVE);
        saveBooking(
                listing, tenant, LocalDate.of(2027, 2, 1), LocalDate.of(2027, 3, 9), BookingStatus.APPROVED);
        Booking later = saveBooking(
                listing, tenant, LocalDate.of(2027, 3, 20), LocalDate.of(2027, 3, 25), BookingStatus.APPROVED);
        saveBooking(
                listing, tenant, LocalDate.of(2027, 3, 15), LocalDate.of(2027, 3, 18), BookingStatus.PENDING);

        List<Booking> result = bookingRepository.findFutureBookingsForListing(listing.getId(), today);

        assertThat(result).extracting(Booking::getId).containsExactly(endingToday.getId(), later.getId());
    }

    @Test
    void listingQueriesReturnOnlyTheOwnerListingsAndActiveListings() {
        User owner = saveUser("listing-owner@example.com", Role.LANDLORD);
        User otherOwner = saveUser("other-listing-owner@example.com", Role.LANDLORD);
        Listing activeOwned = saveListing(owner, Status.ACTIVE, "Kyiv", BigDecimal.valueOf(1000), Set.of("wifi"));
        Listing archivedOwned = saveListing(owner, Status.ARCHIVED, "Kyiv", BigDecimal.valueOf(900), Set.of());
        Listing activeOther = saveListing(otherOwner, Status.ACTIVE, "Lviv", BigDecimal.valueOf(800), Set.of());

        assertThat(listingRepository.findIdsByOwnerId(owner))
                .containsExactlyInAnyOrder(activeOwned.getId(), archivedOwned.getId())
                .doesNotContain(activeOther.getId());

        Page<Listing> activePage = listingRepository.findByStatus(Status.ACTIVE, PageRequest.of(0, 10));

        assertThat(activePage.getContent()).extracting(Listing::getId)
                .containsExactlyInAnyOrder(activeOwned.getId(), activeOther.getId())
                .doesNotContain(archivedOwned.getId());
    }

    @Test
    void listingSearchQueryReturnsMatchingActiveListingsOnly() {
        User owner = saveUser("search-owner@example.com", Role.LANDLORD);
        Listing matching = saveListing(owner, Status.ACTIVE, "Kyiv", BigDecimal.valueOf(1200), Set.of("wifi"));
        saveListing(owner, Status.ACTIVE, "Lviv", BigDecimal.valueOf(1200), Set.of("wifi"));
        saveListing(owner, Status.ARCHIVED, "Kyiv", BigDecimal.valueOf(1200), Set.of("wifi"));

        ListingSearchDto search = new ListingSearchDto();
        search.setCity("Kyiv");
        search.setMinPrice(BigDecimal.valueOf(1000));
        search.setMaxPrice(BigDecimal.valueOf(1500));
        search.setAmenity("wifi");

        Page<ListingDto> result = listingService.searchListings(search, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(ListingDto::getId).containsExactly(matching.getId());
    }

    @Test
    void liquibaseAppliesTheCompleteSchemaAndAllChangelogEntries() {
        Set<String> expectedChangesets = Set.of(
                "01-create-user-table",
                "02-unique-email",
                "03-create-tokens-table",
                "raw",
                "04-add-role-to-users",
                "01-create-listings-table",
                "02-drop-currency",
                "03-create-listing-images-and-amenities",
                "01-create-booking-table",
                "02-add-foreign-keys",
                "01-create-reviews-table",
                "02-add-review-reply",
                "01-create-notifications-table"
        );

        List<String> appliedChangesets = jdbcTemplate.queryForList(
                "SELECT id FROM databasechangelog",
                String.class
        );

        assertThat(appliedChangesets).containsExactlyInAnyOrderElementsOf(expectedChangesets);
        assertThat(tableExists("users")).isTrue();
        assertThat(tableExists("listings")).isTrue();
        assertThat(tableExists("booking")).isTrue();
        assertThat(tableExists("reviews")).isTrue();
        assertThat(tableExists("notifications")).isTrue();
        assertThat(tableExists("listing_images")).isTrue();
        assertThat(tableExists("listing_amenities")).isTrue();
        assertThat(columnExists("listings", "currency")).isFalse();
        assertThat(columnExists("users", "role")).isTrue();
        assertThat(columnExists("tokens", "created_at")).isTrue();
    }

    private User saveUser(String email, Role role) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .password("encoded-password")
                .role(role)
                .status("ACTIVE")
                .build());
    }

    private Listing saveListing(User owner,
                                Status status,
                                String city,
                                BigDecimal monthlyPrice,
                                Set<String> amenities) {
        return listingRepository.saveAndFlush(Listing.builder()
                .owner(owner)
                .title("A comfortable listing")
                .description("A listing used by an integration test")
                .city(city)
                .address("1 Example Street")
                .monthlyPrice(monthlyPrice)
                .rooms((short) 2)
                .area(BigDecimal.valueOf(55.5))
                .propertyType(PropertyType.APARTMENT)
                .status(status)
                .createdAt(OffsetDateTime.now())
                .amenities(new HashSet<>(amenities))
                .build());
    }

    private Booking saveBooking(Listing listing,
                                User tenant,
                                LocalDate startDate,
                                LocalDate endDate,
                                BookingStatus status) {
        return bookingRepository.saveAndFlush(Booking.builder()
                .listing(listing.getId())
                .tenant(tenant.getId())
                .startDate(startDate)
                .endDate(endDate)
                .status(status)
                .createdAt(OffsetDateTime.now())
                .build());
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = 'public' AND table_name = ?",
                Integer.class,
                tableName
        );
        return count != null && count == 1;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = 'public' AND table_name = ? AND column_name = ?",
                Integer.class,
                tableName,
                columnName
        );
        return count != null && count == 1;
    }
}
