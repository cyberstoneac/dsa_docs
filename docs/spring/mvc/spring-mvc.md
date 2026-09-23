# Spring MVC

> **Spring context:** Spring Boot 3.x, Spring MVC 6.x (Jakarta namespace).
> Focus is on the request flow, annotations, exception handling, and the
> things interviewers actually ask.

## Mental Model

Spring MVC is a **front-controller framework** built around the
`DispatcherServlet`. Every HTTP request goes through it.

```d2
direction: right

client: "Client" {
  style.fill: "#e3f2fd"
}
ds: "DispatcherServlet" {
  style.fill: "#bbdefb"
  desc: "Front controller"
}
hm: "HandlerMapping" {
  style.fill: "#c8e6c9"
  desc: "URL → handler method"
}
adapter: "HandlerAdapter" {
  style.fill: "#fff9c4"
  desc: "Invokes handler"
}
ctrl: "Your Controller" {
  style.fill: "#ffe0b2"
}
vr: "ViewResolver" {
  style.fill: "#ffcc80"
  desc: "Only for HTML views"
}
view: "View / Jackson" {
  style.fill: "#f8bbd0"
}

client.ds -> ds: "HTTP"
ds.hm -> hm: "1. find handler"
hm.adapter -> adapter: "2. adapt + invoke"
adapter.ctrl -> ctrl: "3. call method"
ctrl.vr -> vr: "4. ModelAndView\n(or @ResponseBody)"
vr.view -> view: "5. render"
view.client -> client: "6. response"
```

**For REST APIs:**

- `@ResponseBody` (or `@RestController`) bypasses the ViewResolver
- Jackson serializes the return value directly

---

## `DispatcherServlet` — Request Flow

Every request goes through these steps:

| Step | Component | What happens |
|---|---|---|
| 1 | `DispatcherServlet` | Receives request |
| 2 | `HandlerMapping` | Finds the handler method for the URL |
| 3 | `HandlerAdapter` | Adapts the handler invocation |
| 4 | `HandlerInterceptor`s | Runs `preHandle` |
| 5 | Argument resolvers | Bind method arguments (`@PathVariable`, `@RequestBody`, etc.) |
| 6 | Handler method | Executes your controller code |
| 7 | Return value handlers | Process the return (`@ResponseBody`, `ModelAndView`, `ResponseEntity`) |
| 8 | `HandlerInterceptor`s | Runs `postHandle` |
| 9 | Exception handlers | `@ExceptionHandler`, `@ControllerAdvice` if exception thrown |
| 10 | `ViewResolver` | Resolve view (if not `@ResponseBody`) |
| 11 | `HandlerInterceptor`s | Runs `afterCompletion` |

**Interview line:** *"DispatcherServlet is the front controller — it
orchestrates handler mapping, invocation, and response rendering."*

---

## `@Controller` vs `@RestController`

```java
@Controller
public class HtmlController {
    @GetMapping("/home")
    public String home(Model model) {
        model.addAttribute("user", "Alice");
        return "home";   // → resolves to home.html via ViewResolver
    }
}
```

```java
@RestController
public class ApiController {
    @GetMapping("/api/user")
    public User user() {
        return new User("Alice");   // → Jackson JSON response
    }
}
```

### The difference

| | `@Controller` | `@RestController` |
|---|---|---|
| Purpose | HTML views | REST APIs |
| Return value | View name (resolved) | Serialized body |
| Equivalent to | `@Controller` | `@Controller` + `@ResponseBody` |
| ViewResolver | Used | Skipped |

**Interview line:** *"`@RestController` = `@Controller` + `@ResponseBody` on
every method."*

---

## Request Mapping Annotations

### `@RequestMapping` (class + method level)

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @RequestMapping(value = "/{id}", method = RequestMethod.GET)
    public User get(@PathVariable long id) { ... }
}
```

### HTTP-specific shortcuts

| Annotation | Equivalent |
|---|---|
| `@GetMapping` | `@RequestMapping(method = GET)` |
| `@PostMapping` | `@RequestMapping(method = POST)` |
| `@PutMapping` | `@RequestMapping(method = PUT)` |
| `@PatchMapping` | `@RequestMapping(method = PATCH)` |
| `@DeleteMapping` | `@RequestMapping(method = DELETE)` |

**Prefer shortcuts** — clearer and less error-prone.

### Mapping attributes

```java
@GetMapping(
    value = "/users/{id}",
    produces = MediaType.APPLICATION_JSON_VALUE,
    consumes = MediaType.APPLICATION_JSON_VALUE
)
```

- `value` / `path` — URL pattern
- `method` — HTTP method (or use shortcuts)
- `params` — required query params
- `headers` — required headers
- `consumes` — request content types
- `produces` — response content types

### Path variables

```java
@GetMapping("/users/{id}")
public User getUser(@PathVariable long id) { ... }

@GetMapping("/users/{userId}/orders/{orderId}")
public Order getOrder(@PathVariable long userId,
                      @PathVariable long orderId) { ... }

// Rename
@GetMapping("/users/{id}")
public User getUser(@PathVariable("id") long userId) { ... }
```

### Query parameters

```java
@GetMapping("/search")
public List<User> search(@RequestParam String q,
                         @RequestParam(defaultValue = "10") int limit) { ... }
```

Optional:

```java
@RequestParam(required = false) String filter
@RequestParam Optional<String> filter
```

### Request body

```java
@PostMapping("/users")
public User create(@RequestBody CreateUserRequest req) { ... }
```

Jackson deserializes JSON to the object.

### Request headers

```java
@GetMapping("/data")
public Data getData(@RequestHeader("X-Request-Id") String requestId) { ... }
```

### Cookies

```java
@GetMapping("/me")
public User me(@CookieValue("session") String sessionId) { ... }
```

---

## `ResponseEntity<T>` — Full Control

```java
@GetMapping("/users/{id}")
public ResponseEntity<User> getUser(@PathVariable long id) {
    return userRepo.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
}
```

### Builder methods

```java
ResponseEntity.ok(body);
ResponseEntity.created(location).body(body);
ResponseEntity.noContent().build();
ResponseEntity.badRequest().body(error);
ResponseEntity.status(HttpStatus.CONFLICT).body(error);
```

### Custom headers

```java
return ResponseEntity.ok()
        .header("X-Request-Id", requestId)
        .contentType(MediaType.APPLICATION_JSON)
        .body(user);
```

### Comparison

| Return type | Status | Body |
|---|---|---|
| `T` | 200 | Serialized T |
| `ResponseEntity<T>` | You choose | Serialized T |
| `void` | 200 (or 204 if no body) | Empty |
| `ResponseEntity<Void>` | You choose | Empty |

**Interview line:** *"Use `ResponseEntity` when you need to control status
and headers — otherwise return the object directly."*

---

## Argument Binding

### `@RequestBody`

Jackson binds the request body to the parameter. Content-Type must be
`application/json` (or another compatible type).

### `@ModelAttribute`

Binds form data or query params to an object.

```java
@PostMapping("/users")
public String create(@ModelAttribute UserForm form) { ... }
```

Used with HTML forms. For REST, use `@RequestBody`.

### `@RequestParam` vs `@PathVariable`

| | `@RequestParam` | `@PathVariable` |
|---|---|---|
| Source | Query string (`?q=foo`) | URL path (`/users/{id}`) |
| Purpose | Filtering, pagination | Resource identification |

**REST best practice:** use `@PathVariable` for resource IDs, `@RequestParam`
for filters and options.

### `@Valid` and `@Validated`

```java
@PostMapping("/users")
public ResponseEntity<User> create(@Valid @RequestBody CreateUserRequest req,
                                   BindingResult binding) {
    if (binding.hasErrors()) {
        // handle validation errors
    }
    ...
}
```

- `@Valid` — JSR-303 validation
- `@Validated` — Spring variant with group support
- `BindingResult` — must immediately follow the validated argument

**If you don't declare `BindingResult`, validation failures throw
`MethodArgumentNotValidException`.**

---

## `@ControllerAdvice` — Global Exception Handling

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_FAILED", message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAll(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("INTERNAL_ERROR", "Something went wrong"));
    }
}
```

### `@RestControllerAdvice` vs `@ControllerAdvice`

`@RestControllerAdvice` = `@ControllerAdvice` + `@ResponseBody` — returns
serialized objects instead of view names.

**Use `@RestControllerAdvice` for REST APIs.**

### Scoping advice

```java
@RestControllerAdvice(basePackages = "com.example.api")
@RestControllerAdvice(assignableTypes = {UserController.class})
@RestControllerAdvice(annotations = RestController.class)
```

**Prefer specific scoping** over a blanket `@ExceptionHandler(Exception.class)`
that swallows everything.

### Common handler for `@Valid` failures

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ValidationError> handleValidation(
        MethodArgumentNotValidException ex) {
    Map<String, String> errors = ex.getBindingResult()
            .getFieldErrors().stream()
            .collect(Collectors.toMap(
                    FieldError::getField,
                    FieldError::getDefaultMessage,
                    (a, b) -> a));
    return ResponseEntity.badRequest().body(new ValidationError(errors));
}
```

---

## `HandlerInterceptor`

Runs **around** the handler — a servlet `Filter` for Spring MVC.

```java
@Component
public class LoggingInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest req,
                             HttpServletResponse res,
                             Object handler) {
        System.out.println("Before: " + req.getRequestURI());
        return true;   // false = stop the chain
    }

    @Override
    public void postHandle(HttpServletRequest req,
                           HttpServletResponse res,
                           Object handler,
                           ModelAndView mv) {
        System.out.println("After: " + req.getRequestURI());
    }

    @Override
    public void afterCompletion(HttpServletRequest req,
                                HttpServletResponse res,
                                Object handler,
                                Exception ex) {
        // always runs, even on exception
    }
}
```

### Register

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new LoggingInterceptor())
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/public/**");
    }
}
```

### `Filter` vs `Interceptor`

| | `Filter` | `Interceptor` |
|---|---|---|
| Level | Servlet API | Spring MVC |
| Runs | Before/after DispatcherServlet | Around the handler method |
| Access to handler | ❌ | ✅ |
| Access to Spring beans | ⚠️ via ApplicationContext | ✅ direct |
| Use | CORS, security, encoding | Auth, logging, model population |

**Interview line:** *"Filters are servlet-level; interceptors are
Spring MVC-level with access to the handler."*

---

## CORS Configuration

Two options in Spring MVC:

### 1. `@CrossOrigin` on controllers

```java
@RestController
@CrossOrigin(origins = "https://app.example.com")
public class UserController { ... }
```

### 2. Global config

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("https://app.example.com")
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
```

**Trap:** CORS is enforced by the browser, not the server. `curl` ignores it.

**Trap:** If Spring Security is on the classpath, you also need CORS
configuration in the security filter chain — see
[Security Basics](../security/spring-security-basics.md#cors).

---

## Message Converters

Convert between HTTP content and Java objects.

| Converter | Content types |
|---|---|
| `MappingJackson2HttpMessageConverter` | `application/json` |
| `StringHttpMessageConverter` | `text/plain` |
| `FormHttpMessageConverter` | `application/x-www-form-urlencoded` |
| `ByteArrayHttpMessageConverter` | `application/octet-stream` |
| `Jaxb2RootElementHttpMessageConverter` | `application/xml` |

**Jackson is the default for JSON.** Customize the `ObjectMapper` to control
date formats, null handling, etc.

```java
@Configuration
public class JacksonConfig {
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jsonCustomizer() {
        return builder -> builder
                .serializationInclusion(JsonInclude.Include.NON_NULL)
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
```

---

## `ProblemDetail` — RFC 7807 (Spring 6+)

Standard error response format:

```java
@ExceptionHandler(ResourceNotFoundException.class)
public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Resource Not Found");
    problem.setProperty("resourceId", ex.getResourceId());
    return problem;
}
```

Response:

```json
{
  "type": "about:blank",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "User 42 not found",
  "resourceId": 42
}
```

**Interview line:** *"Spring 6 supports RFC 7807 `ProblemDetail` for standard
error responses."*

---

## Testing Controllers

### `@WebMvcTest` — slice test

```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void returnsUser() throws Exception {
        given(userService.getUser(1L)).willReturn(new User(1L, "Alice"));

        mockMvc.perform(get("/api/users/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alice"));
    }
}
```

**`@WebMvcTest`** loads only MVC-related beans — no service layer, no DB.

### `MockMvc` for POST with body

```java
mockMvc.perform(post("/api/users")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
                {"name":"Alice","email":"alice@example.com"}
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").exists());
```

### `@SpringBootTest` with `MockMvc` — full integration

```java
@SpringBootTest
@AutoConfigureMockMvc
class FullIntegrationTest {
    @Autowired private MockMvc mockMvc;
    // ...
}
```

For real HTTP, use `TestRestTemplate` or `WebTestClient` with
`@SpringBootTest(webEnvironment = RANDOM_PORT)`.

---

## Tricky Corners ⚠️

**`@RestController` = `@Controller` + `@ResponseBody`.** Every method's
return value is serialized.

**`@RequestBody` requires a matching content type.** Missing
`Content-Type: application/json` fails with 415.

**`BindingResult` must immediately follow the validated argument.** Otherwise
Spring throws before you can handle errors.

**`@ExceptionHandler(Exception.class)` swallows real bugs.** Log the
exception and think about whether generic handling is appropriate.

**`@ControllerAdvice` doesn't catch exceptions in filters.** Filters run
before Spring MVC — use `HandlerExceptionResolver` or a servlet-level
handler.

**`@Transactional` on a controller method is an anti-pattern.** Transaction
boundaries belong in the service layer.

**Circular references in `@ResponseBody` models** cause `StackOverflowError`
during serialization. Use DTOs.

**Jackson serializes lazy JPA entities and triggers N+1.** Return DTOs from
controllers.

**`@PathVariable` and `@RequestParam` cannot be `null` unless `required=false`
or `Optional`.**

**`@RequestParam(defaultValue = "...")` is interpreted literally** — no SpEL.

**`@ModelAttribute` runs before `@RequestMapping`.** Useful for common model
setup.

**`@RestControllerAdvice` methods must not be `private`** — Spring's
reflection can't invoke them.

**`ProblemDetail` is not enabled by default.** You must return it from a
handler.

**Exception handlers for the same exception in different advices** — the
most specific one wins.

**`HandlerInterceptor.preHandle` returning `false` stops the chain** — no
handler method runs. `postHandle` is skipped; `afterCompletion` still runs.

**`HandlerInterceptor` vs `@ControllerAdvice`** — interceptors run **around**
every handler; advice runs **after** an exception.

**`spring.mvc.throw-exception-if-no-handler-found=true`** for 404s to flow
through `@ControllerAdvice`. Otherwise Spring handles them internally.

---

## Common Pitfalls

- Returning JPA entities from controllers (N+1 + lazy-init issues).
- Using `@ControllerAdvice` for exceptions thrown in filters.
- Assuming `@ExceptionHandler` catches everything.
- Forgetting `@ResponseBody`/`@RestController` on REST APIs.
- Using `@Transactional` on controller methods.
- Manual CORS config in Spring MVC without mirroring it in Spring Security.
- Serializing cycles in bidirectional entities.
- Not declaring `BindingResult` and getting raw 400s.
- Missing `Content-Type` on `@RequestBody` requests.

---

## Key Interview Tips

- Explain `DispatcherServlet` in 3 steps: find handler, invoke, render.
- Say **"`@RestController` = `@Controller` + `@ResponseBody`."**
- Distinguish **`@RequestParam` vs `@PathVariable`**.
- Explain **`@ControllerAdvice`** for global exception handling with
  `@ExceptionHandler` methods.
- Say **"`@ControllerAdvice` doesn't catch filter exceptions."**
- Mention **filters vs interceptors** — servlet vs Spring MVC.
- Say **"`ResponseEntity` for status + headers; plain object otherwise."**
- Mention **`ProblemDetail` (RFC 7807)** in Spring 6+.

---

## Related

- [Security Basics](../security/spring-security-basics.md) — securing
  endpoints
- [Method Security](../security/method-security.md) — `@PreAuthorize` on
  controllers
- [Spring Data JPA](../data/spring-data-jpa.md) — avoid returning entities
  directly
- [N+1 Problem](../data/n-plus-one.md) — Jackson serialization triggers N+1
- [Configuration](../boot/configuration.md) — `spring.mvc.*` properties