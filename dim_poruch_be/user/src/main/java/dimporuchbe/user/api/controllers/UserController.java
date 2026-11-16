package dimporuchbe.user.api.controllers;

import dimporuchbe.user.api.dtos.UserPublicProfileDto;
import dimporuchbe.user.application.UserService;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Public user information")
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}/public-profile")
    @Operation(summary = "Get a user's public profile")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Public profile returned",
                    content = @Content(schema = @Schema(implementation = UserPublicProfileDto.class))),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<UserPublicProfileDto> getPublicProfile(
            @Parameter(description = "User identifier", required = true)
            @PathVariable UUID id) {
        return ResponseEntity.ok(userService.getPublicProfile(id));
    }
}
