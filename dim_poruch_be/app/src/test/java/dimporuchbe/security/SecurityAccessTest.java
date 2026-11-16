package dimporuchbe.security;

import dimporuchbe.admin.api.controllers.AdminController;
import dimporuchbe.admin.application.AdminService;
import dimporuchbe.admin.api.dtos.AdminDashboardStatsDto;
import dimporuchbe.listings.api.controllers.ListingsController;
import dimporuchbe.listings.api.dtos.CreateListingRequestDto;
import dimporuchbe.listings.api.dtos.CreateListingResponseDto;
import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.application.ListingService;
import dimporuchbe.security.config.JwtAuthenticationFilter;
import dimporuchbe.security.config.JwtService;
import dimporuchbe.security.config.SecurityConfig;
import dimporuchbe.security.config.TokenRevocationService;
import dimporuchbe.security.exception.CustomAccessDeniedHandler;
import dimporuchbe.security.exception.CustomAuthenticationEntryPoint;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.data.domain.Page;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {ListingsController.class, AdminController.class})
@ContextConfiguration(classes = SecurityAccessTest.TestWebConfiguration.class)
@Import({
        ListingsController.class,
        AdminController.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        CustomAuthenticationEntryPoint.class,
        CustomAccessDeniedHandler.class
})
class SecurityAccessTest {

    @Configuration(proxyBeanMethods = false)
    static class TestWebConfiguration {
    }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ListingService listingService;

    @MockitoBean
    private AdminService adminService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private TokenRevocationService tokenRevocationService;

    @Test
    void publicListingReadIsAvailableWithoutAuthentication() throws Exception {
        when(listingService.findListingById(any(UUID.class)))
                .thenReturn(ListingDto.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(get("/listings/{id}", UUID.randomUUID()))
                .andExpect(status().isOk());
    }

    @Test
    void protectedListingEndpointReturnsUnauthorizedWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/listings/my"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @WithMockUser(username = "tenant@example.com", roles = "TENANT")
    void tenantCannotUseLandlordOnlyListingEndpoint() throws Exception {
        mockMvc.perform(get("/listings/my"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @WithMockUser(username = "landlord@example.com", roles = "LANDLORD")
    void landlordCanUseLandlordOnlyListingEndpoint() throws Exception {
        when(listingService.getMyListings(eq("landlord@example.com"), any()))
                .thenReturn(Page.empty());

        mockMvc.perform(get("/listings/my"))
                .andExpect(status().isOk());

        verify(listingService).getMyListings(eq("landlord@example.com"), any());
    }

    @Test
    void listingCreationReturnsUnauthorizedWithoutAuthentication() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/listings")
                        .contentType(APPLICATION_JSON)
                        .content(validListingJson()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "tenant@example.com", roles = "TENANT")
    void tenantCannotCreateAListing() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.post("/listings")
                        .contentType(APPLICATION_JSON)
                        .content(validListingJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "landlord@example.com", roles = "LANDLORD")
    void landlordCanCreateAListing() throws Exception {
        UUID listingId = UUID.randomUUID();
        when(listingService.createListing(any(CreateListingRequestDto.class), eq("landlord@example.com")))
                .thenReturn(CreateListingResponseDto.builder()
                        .listingId(listingId)
                        .message("Listing created successfully!")
                        .build());

        mockMvc.perform(MockMvcRequestBuilders.post("/listings")
                        .contentType(APPLICATION_JSON)
                        .content(validListingJson()))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(username = "landlord@example.com", roles = "LANDLORD")
    void nonAdminCannotAccessAdminEndpoints() throws Exception {
        mockMvc.perform(get("/admin/dashboard/stats"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void adminCanAccessAdminEndpoints() throws Exception {
        when(adminService.getDashboardStats()).thenReturn(AdminDashboardStatsDto.builder().build());

        mockMvc.perform(get("/admin/dashboard/stats"))
                .andExpect(status().isOk());
    }

    private String validListingJson() {
        return """
                {
                  "title": "Bright two-room apartment",
                  "description": "A full listing description",
                  "city": "Kyiv",
                  "address": "1 Example Street",
                  "monthlyPrice": 1500.00,
                  "rooms": 2,
                  "area": 55.5,
                  "propertyType": "APARTMENT",
                  "amenities": ["wifi"]
                }
                """;
    }
}
