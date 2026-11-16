package dimporuchbe.listings.application;

import dimporuchbe.listings.api.dtos.ListingSearchDto;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingImageRepository;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.user.persistence.UserRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ListingSpecificationTest {

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private ListingImageRepository listingImageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ListingImageStorageService listingImageStorageService;

    @ParameterizedTest(name = "{0}")
    @MethodSource("searchParameters")
    @SuppressWarnings("unchecked")
    void buildsSearchSpecificationForAllParameterCombinations(
            String caseName,
            ListingSearchDto searchParameters) {
        ListingService listingService = new ListingService(
                listingRepository,
                listingImageRepository,
                userRepository,
                listingImageStorageService
        );
        Pageable pageable = PageRequest.of(0, 20);
        when(listingRepository.findAll(any(Specification.class), eq(pageable)))
                .thenReturn(Page.empty(pageable));

        assertThatCode(() -> listingService.searchListings(searchParameters, pageable))
                .doesNotThrowAnyException();

        ArgumentCaptor<Specification<Listing>> specificationCaptor = ArgumentCaptor.forClass(Specification.class);
        verify(listingRepository).findAll(specificationCaptor.capture(), eq(pageable));
        assertThat(specificationCaptor.getValue()).as(caseName).isNotNull();
    }

    private static Stream<Arguments> searchParameters() {
        ListingSearchDto allParameters = new ListingSearchDto();
        allParameters.setCity("Kyiv");
        allParameters.setMinPrice(BigDecimal.valueOf(500));
        allParameters.setMaxPrice(BigDecimal.valueOf(1500));
        allParameters.setRooms((short) 2);
        allParameters.setPropertyType("APARTMENT");
        allParameters.setAmenity("wifi");

        ListingSearchDto partialParameters = new ListingSearchDto();
        partialParameters.setCity("Kyiv");
        partialParameters.setMinPrice(BigDecimal.valueOf(500));

        return Stream.of(
                Arguments.of("all parameters", allParameters),
                Arguments.of("partially filled parameters", partialParameters),
                Arguments.of("empty parameter object", new ListingSearchDto()),
                Arguments.of("no parameter object", null)
        );
    }
}
