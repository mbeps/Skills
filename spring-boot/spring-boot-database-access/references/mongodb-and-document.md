# Spring Data MongoDB & Document Database Reference Guide

An authoritative, production-grade reference for building high-performance document database access layers using **Spring Data MongoDB** (compatible with Spring Boot 3.x and 4.0, Spring Data MongoDB 4/5, Java 17/21).

---

## Table of Contents
1. [Document Modeling & Mapping](#1-document-modeling--mapping)
   - [Document & Identity Strategies](#document--identity-strategies)
   - [Field Mappings, Exclusions & Client-Side Encryption](#field-mappings-exclusions--client-side-encryption)
   - [Indexing Strategies & Production Index Lifecycle](#indexing-strategies--production-index-lifecycle)
   - [Entity Auditing](#entity-auditing)
2. [Repository & Querying Patterns](#2-repository--querying-patterns)
   - [MongoRepository & Derived Query Methods](#mongorepository--derived-query-methods)
   - [JSON `@Query` Annotations](#json-query-annotations)
   - [Dynamic Queries via Query & Criteria](#dynamic-queries-via-query--criteria)
   - [DTO Projections & Field Inclusions](#dto-projections--field-inclusions)
3. [MongoTemplate & Aggregation Pipelines](#3-mongotemplate--aggregation-pipelines)
   - [Complex Aggregation Pipelines](#complex-aggregation-pipelines)
   - [Type-Safe Aggregation Results Mapping](#type-safe-aggregation-results-mapping)
   - [Atomic Operations, Counters, Upserts & Array Updates](#atomic-operations-counters-upserts--array-updates)
4. [Transactions & Performance Tuning](#4-transactions--performance-tuning)
   - [Multi-Document Transactions & `MongoTransactionManager`](#multi-document-transactions--mongotransactionmanager)
   - [MongoClientSettings & Connection Pool Tuning](#mongoclientsettings--connection-pool-tuning)
   - [Write Concerns & Read Preferences](#write-concerns--read-preferences)
5. [Common Pitfalls & Anti-Patterns](#5-common-pitfalls--anti-patterns)
   - [Treating MongoDB Like SQL (Embedding vs Referencing)](#treating-mongodb-like-sql-embedding-vs-referencing)
   - [Unindexed Collection Scans (COLLSCAN vs IXSCAN & ESR Rule)](#unindexed-collection-scans-collscan-vs-ixscan--esr-rule)
   - [Unbounded Arrays & 16MB BSON Document Limit](#unbounded-arrays--16mb-bson-document-limit)
   - [Transaction Overuse in Document Databases](#transaction-overuse-in-document-databases)

---

## 1. Document Modeling & Mapping

### Document & Identity Strategies

Spring Data MongoDB maps Java objects to BSON documents. Every root document collection must declare an identity field annotated with `@Id`.

```java
package com.example.mongodb.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Document(collection = "orders")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class OrderDocument {

    /**
     * Primary Key Strategies:
     * 1. String id with ObjectId hex: Generated automatically by MongoDB server or driver.
     * 2. ObjectId id: Direct BSON ObjectId representation.
     * 3. UUID id: Requires explicit UUID representation configuration (STANDARD).
     * 4. Custom Natural String (e.g. "ORD-2026-X891"): Application-assigned before insert.
     */
    @Id
    private String id; // Automatically hex-encoded ObjectId or natural business key

    @Field(name = "order_number")
    private String orderNumber;

    @Field(name = "customer_id", targetType = FieldType.OBJECT_ID)
    private String customerId;

    @Field(name = "status")
    private OrderStatus status;

    @Field(name = "total_amount", targetType = FieldType.DECIMAL128)
    private BigDecimal totalAmount;

    @Builder.Default
    @Field(name = "items")
    private List<OrderItem> items = new ArrayList<>();

    @Field(name = "shipping_address")
    private Address shippingAddress;

    @Version
    private Long version; // Optimistic locking support
}
```

#### ID Strategy Comparison

| Strategy                 | Type                         | Storage Size                | Index Performance                     | Generation                   |
| :----------------------- | :--------------------------- | :-------------------------- | :------------------------------------ | :--------------------------- |
| **BSON ObjectId**        | `String` (hex) or `ObjectId` | 12 bytes                    | Excellent (chronologically clustered) | Driver / Server              |
| **UUID (Standard)**      | `UUID`                       | 16 bytes (binary subtype 4) | High                                  | Client / `UUID.randomUUID()` |
| **Natural Business Key** | `String`                     | Variable                    | Moderate to High (B-Tree indexed)     | Application service          |

---

### Field Mappings, Exclusions & Client-Side Encryption

#### Field Mappings & Transient Data

```java
package com.example.mongodb.domain.model;

import java.math.BigDecimal;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {

    @Field(name = "sku")
    private String sku;

    @Field(name = "name")
    private String productName;

    @Field(name = "unit_price", targetType = FieldType.DECIMAL128)
    private BigDecimal unitPrice;

    @Field(name = "qty")
    private int quantity;

    /**
     * @Transient: Not persisted to MongoDB. Used only in-memory.
     */
    @Transient
    private BigDecimal calculatedSubTotal;

    /**
     * @ReadOnlyProperty: Read from MongoDB when populated by aggregation/lookup,
     * but ignored during repository save() or insert().
     */
    @ReadOnlyProperty
    private String warehouseLocation;
}
```

#### Client-Side Field Level Encryption (CSFLE / Encrypted Fields)

Spring Data MongoDB supports CSFLE using `@Encrypted` annotations and automatic encryption configurations for sensitive fields (PII, PCI-DSS compliance).

```java
package com.example.mongodb.domain.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Encrypted;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "customer_profiles")
@Encrypted(keyId = "${spring.data.mongodb.encryption.key-id}")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerProfileDocument {

    @Id
    private String id;

    @Field(name = "full_name")
    private String fullName;

    /**
     * Encrypted deterministically to allow exact-match equality queries:
     * algorithm = "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic"
     */
    @Encrypted(algorithm = "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic")
    @Field(name = "ssn")
    private String ssn;

    /**
     * Encrypted randomly when equality searches are not required:
     * algorithm = "AEAD_AES_256_CBC_HMAC_SHA_512-Random"
     */
    @Encrypted(algorithm = "AEAD_AES_256_CBC_HMAC_SHA_512-Random")
    @Field(name = "card_number")
    private String creditCardNumber;
}
```

---

### Indexing Strategies & Production Index Lifecycle

#### Index Annotations

```java
package com.example.mongodb.domain.model;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "audit_events")
@CompoundIndexes({
    // Follows ESR rule (Equality: tenant_id, Sort: timestamp DESC, Range: event_type)
    @CompoundIndex(
        name = "idx_tenant_timestamp_type",
        def = "{ 'tenant_id': 1, 'timestamp': -1, 'event_type': 1 }"
    )
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEventDocument {

    @Id
    private String id;

    @Indexed(name = "idx_tenant_id")
    @Field(name = "tenant_id")
    private String tenantId;

    @Indexed(name = "idx_correlation_id", unique = true, sparse = true)
    @Field(name = "correlation_id")
    private String correlationId;

    /**
     * TTL Index: Automatically drops documents after the specified interval.
     */
    @Indexed(name = "idx_ttl_expire", expireAfterSeconds = 2592000) // 30 days
    @Field(name = "timestamp")
    private Instant timestamp;

    @TextIndexed(weight = 3.0f)
    @Field(name = "summary")
    private String summary;

    @TextIndexed(weight = 1.0f)
    @Field(name = "details")
    private String details;

    /**
     * 2dsphere GeoSpatial Index for location queries (within, near).
     */
    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    @Field(name = "location")
    private GeoJsonPoint location;
}
```

#### Why `auto-index-creation` in Production is Discouraged

In `application.yml`:
```yaml
spring:
  data:
    mongodb:
      auto-index-creation: false
```

> **Production Rule:** Always set `spring.data.mongodb.auto-index-creation=false` in production.
>
> 1. **Startup Latency & Blocking:** When application instances scale horizontally, multiple nodes attempting to build compound or large indexes concurrently cause metadata locking, high memory spikes, and container startup timeouts.
> 2. **Index Configuration Drift:** If an index definition changes in annotations, Spring Data will not drop or safely migrate existing indexes; it can fail or create conflicting index names.
> 3. **Controlled Deployments:** Production indexes must be managed via versioned migration frameworks (e.g. Mongock) or standalone DBA initialization scripts.

#### Programmatic Index Initialization

For development, testing, or controlled startup tasks:

```java
package com.example.mongodb.config;

import com.example.mongodb.domain.model.AuditEventDocument;
import com.example.mongodb.domain.model.OrderDocument;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.IndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import lombok.RequiredArgsConstructor;

@Configuration
@Profile({"dev", "test", "local"})
@RequiredArgsConstructor
public class MongoIndexInitializer {

    private static final Logger log = LoggerFactory.getLogger(MongoIndexInitializer.class);

    private final MongoTemplate mongoTemplate;
    private final MongoMappingContext mongoMappingContext;

    @PostConstruct
    public void ensureIndexes() {
        log.info("Initializing MongoDB indexes programmatically...");

        IndexResolver resolver = new MongoPersistentEntityIndexResolver(mongoMappingContext);
        
        // Auto-resolve declared annotations for specific entity classes
        createIndexesForEntity(OrderDocument.class, resolver);
        createIndexesForEntity(AuditEventDocument.class, resolver);

        // Explicit programmatic index creation with specific options
        IndexOperations orderIndexOps = mongoTemplate.indexOps(OrderDocument.class);
        orderIndexOps.ensureIndex(
            new Index()
                .on("customer_id", Sort.Direction.ASC)
                .on("order_number", Sort.Direction.ASC)
                .named("idx_custom_customer_orderno")
        );

        log.info("MongoDB indexes verified successfully.");
    }

    private <T> void createIndexesForEntity(Class<T> entityClass, IndexResolver resolver) {
        IndexOperations indexOps = mongoTemplate.indexOps(entityClass);
        resolver.resolveIndexFor(entityClass).forEach(indexOps::ensureIndex);
    }
}
```

---

### Entity Auditing

Enable transparent tracking of document creation, modification timestamps, and modifier identities.

#### Auditing Configuration & AuditorAware

```java
package com.example.mongodb.config;

import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Configuration
@EnableMongoAuditing(auditorAwareRef = "springSecurityAuditorAware", modifyOnCreate = false)
public class MongoAuditConfig {

    @Bean
    public AuditorAware<String> springSecurityAuditorAware() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .filter(Authentication::isAuthenticated)
                .map(Authentication::getName)
                .or(() -> Optional.of("SYSTEM"));
    }
}
```

#### Audited Document Base Class

```java
package com.example.mongodb.domain.model;

import java.time.Instant;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public abstract class AuditableDocument {

    @CreatedDate
    @Field(name = "created_at")
    private Instant createdAt;

    @CreatedBy
    @Field(name = "created_by")
    private String createdBy;

    @LastModifiedDate
    @Field(name = "updated_at")
    private Instant updatedAt;

    @LastModifiedBy
    @Field(name = "updated_by")
    private String updatedBy;
}
```

---

## 2. Repository & Querying Patterns

### MongoRepository & Derived Query Methods

Spring Data MongoDB resolves query method names into native MongoDB BSON query filters.

```java
package com.example.mongodb.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import com.example.mongodb.domain.model.OrderDocument;
import com.example.mongodb.domain.model.OrderStatus;

@Repository
public interface OrderRepository extends MongoRepository<OrderDocument, String> {

    // Derived Query: Equality and Range
    List<OrderDocument> findByStatusAndCreatedAtAfter(OrderStatus status, Instant timestamp);

    // Derived Query: In-clause and greater than
    List<OrderDocument> findByStatusInAndTotalAmountGreaterThan(List<OrderStatus> statuses, BigDecimal threshold);

    // Pagination (COUNT query executed for total items)
    Page<OrderDocument> findByCustomerId(String customerId, Pageable pageable);

    // Slice pagination (No COUNT query, performs LIMIT N + 1 for fast infinite scroll)
    Slice<OrderDocument> findByStatus(OrderStatus status, Pageable pageable);

    // Case-insensitive regex match
    List<OrderDocument> findByOrderNumberRegex(String regexPattern);

    // Existence check
    boolean existsByOrderNumber(String orderNumber);

    // Delete with return count
    long deleteByCustomerIdAndStatus(String customerId, OrderStatus status);
}
```

---

### JSON `@Query` Annotations

Use `@Query` when derived query method names become unwieldy or when precise BSON operators (`$or`, `$elemMatch`, `$regex`, `$near`) are required.

```java
package com.example.mongodb.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import com.example.mongodb.domain.model.OrderDocument;
import com.example.mongodb.domain.model.OrderStatus;

@Repository
public interface AdvancedOrderRepository extends MongoRepository<OrderDocument, String> {

    // JSON Query with placeholder binding
    @Query("{ 'status': ?0, 'total_amount': { $lte: ?1 } }")
    List<OrderDocument> findMatchingOrders(OrderStatus status, BigDecimal maxPrice);

    // Array $elemMatch query
    @Query("{ 'items': { $elemMatch: { 'sku': ?0, 'qty': { $gte: ?1 } } } }")
    List<OrderDocument> findOrdersContainingItemWithMinimumQty(String sku, int minQty);

    // Date range and $in evaluation
    @Query("{ 'created_at': { $gte: ?0, $lt: ?1 }, 'status': { $in: ?2 } }")
    List<OrderDocument> findOrdersWithinDateRange(Instant from, Instant to, List<OrderStatus> statuses);

    // JSON Query with explicit sort in BSON syntax
    @Query(value = "{ 'customer_id': ?0 }", sort = "{ 'created_at': -1 }")
    List<OrderDocument> findCustomerOrdersSorted(String customerId);

    // Custom Count Query override for custom Pageable queries
    @Query(
        value = "{ 'customer_id': ?0, 'status': { $ne: 'CANCELLED' } }",
        count = true
    )
    long countActiveCustomerOrders(String customerId);
}
```

---

### Dynamic Queries via Query & Criteria

When search filters have optional parameters, use `MongoTemplate` with programmatic `Criteria` chaining to avoid building massive conditional permutations.

```java
package com.example.mongodb.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;
import com.example.mongodb.domain.model.OrderDocument;
import com.example.mongodb.domain.model.OrderStatus;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DynamicOrderSearchRepository {

    private final MongoTemplate mongoTemplate;

    @Getter
    @Builder
    public static class OrderSearchCriteria {
        private String customerId;
        private OrderStatus status;
        private BigDecimal minAmount;
        private BigDecimal maxAmount;
        private Instant createdAfter;
        private String itemSku;
    }

    public Page<OrderDocument> searchOrders(OrderSearchCriteria filter, Pageable pageable) {
        List<Criteria> criteriaList = new ArrayList<>();

        if (filter.getCustomerId() != null && !filter.getCustomerId().isBlank()) {
            criteriaList.add(Criteria.where("customer_id").is(filter.getCustomerId()));
        }

        if (filter.getStatus() != null) {
            criteriaList.add(Criteria.where("status").is(filter.getStatus()));
        }

        if (filter.getMinAmount() != null || filter.getMaxAmount() != null) {
            Criteria amountCriteria = Criteria.where("total_amount");
            if (filter.getMinAmount() != null) {
                amountCriteria.gte(filter.getMinAmount());
            }
            if (filter.getMaxAmount() != null) {
                amountCriteria.lte(filter.getMaxAmount());
            }
            criteriaList.add(amountCriteria);
        }

        if (filter.getCreatedAfter() != null) {
            criteriaList.add(Criteria.where("created_at").gte(filter.getCreatedAfter()));
        }

        if (filter.getItemSku() != null && !filter.getItemSku().isBlank()) {
            criteriaList.add(Criteria.where("items").elemMatch(Criteria.where("sku").is(filter.getItemSku())));
        }

        Query query = new Query();
        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }

        // Count total matches for pagination
        long totalCount = mongoTemplate.count(query, OrderDocument.class);

        // Apply pageable (skip, limit, sort)
        query.with(pageable);
        List<OrderDocument> results = mongoTemplate.find(query, OrderDocument.class);

        return new PageImpl<>(results, pageable, totalCount);
    }
}
```

---

### DTO Projections & Field Inclusions

Avoid retrieving large documents when only a subset of attributes is needed.

#### 1. Interface-based Closed Projection
```java
public interface OrderSummaryProjection {
    String getId();
    String getOrderNumber();
    BigDecimal getTotalAmount();
    OrderStatus getStatus();
}
```

#### 2. Record / Class-based DTO Projection
```java
public record OrderDto(
    String id,
    String orderNumber,
    BigDecimal totalAmount,
    OrderStatus status
) {}
```

#### 3. Field Inclusion Query in Repository
```java
package com.example.mongodb.repository;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import com.example.mongodb.domain.model.OrderDocument;

@Repository
public interface ProjectedOrderRepository extends MongoRepository<OrderDocument, String> {

    // Projection using DTO class binding
    <T> List<T> findByCustomerId(String customerId, Class<T> projectionType);

    // Explicit field inclusion projection via JSON query
    // 1 indicates include, 0 indicates exclude (_id is included by default unless _id: 0)
    @Query(
        value = "{ 'customer_id': ?0 }",
        fields = "{ 'order_number': 1, 'total_amount': 1, 'status': 1, '_id': 1 }"
    )
    List<OrderSummaryProjection> findSummariesByCustomerId(String customerId);
}
```

---

## 3. MongoTemplate & Aggregation Pipelines

### Complex Aggregation Pipelines

Spring Data MongoDB provides a fluent pipeline builder supporting aggregation stages (`$match`, `$project`, `$group`, `$unwind`, `$lookup`, `$sort`, `$facet`, `$bucket`).

```java
package com.example.mongodb.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.BucketOperation;
import org.springframework.data.mongodb.core.aggregation.FacetOperation;
import org.springframework.data.mongodb.core.aggregation.GroupOperation;
import org.springframework.data.mongodb.core.aggregation.LookupOperation;
import org.springframework.data.mongodb.core.aggregation.MatchOperation;
import org.springframework.data.mongodb.core.aggregation.ProjectionOperation;
import org.springframework.data.mongodb.core.aggregation.SortOperation;
import org.springframework.data.mongodb.core.aggregation.UnwindOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OrderAnalyticsService {

    private final MongoTemplate mongoTemplate;

    @Getter
    @Builder
    public static class CustomerSalesSummary {
        private String customerId;
        private String customerName;
        private String customerEmail;
        private long totalOrdersCount;
        private BigDecimal totalSpend;
        private double averageOrderValue;
    }

    /**
     * Executes: $match -> $unwind -> $lookup -> $group -> $project -> $sort
     */
    public List<CustomerSalesSummary> getTopSpendingCustomers(Instant since, BigDecimal minTotalSpend) {
        // Stage 1: $match - Filter non-cancelled orders since timestamp
        MatchOperation matchStage = Aggregation.match(
            Criteria.where("status").ne("CANCELLED")
                    .and("created_at").gte(since)
        );

        // Stage 2: $lookup - Join with customers collection
        LookupOperation lookupStage = LookupOperation.newLookup()
            .from("customers")
            .localField("customer_id")
            .foreignField("_id")
            .as("customer_details");

        // Stage 3: $unwind - Flatten customer array resulting from lookup
        UnwindOperation unwindCustomer = Aggregation.unwind("customer_details", true);

        // Stage 4: $group - Aggregate metrics per customer
        GroupOperation groupStage = Aggregation.group("customer_id")
            .first("customer_details.name").as("customerName")
            .first("customer_details.email").as("customerEmail")
            .count().as("totalOrdersCount")
            .sum("total_amount").as("totalSpend")
            .avg("total_amount").as("averageOrderValue");

        // Stage 5: $match - Post-group filtering (HAVING equivalent)
        MatchOperation filterHighSpenders = Aggregation.match(
            Criteria.where("totalSpend").gte(minTotalSpend)
        );

        // Stage 6: $sort - Sort descending by total spend
        SortOperation sortStage = Aggregation.sort(Sort.Direction.DESC, "totalSpend");

        // Stage 7: $project - Shape output document
        ProjectionOperation projectStage = Aggregation.project("customerName", "customerEmail", "totalOrdersCount", "totalSpend", "averageOrderValue")
            .and("_id").as("customerId");

        Aggregation aggregation = Aggregation.newAggregation(
            matchStage,
            lookupStage,
            unwindCustomer,
            groupStage,
            filterHighSpenders,
            sortStage,
            projectStage
        );

        AggregationResults<CustomerSalesSummary> results = mongoTemplate.aggregate(
            aggregation,
            "orders",
            CustomerSalesSummary.class
        );

        return results.getMappedResults();
    }

    /**
     * Aggregation using $facet and $bucket for multi-dimensional analytics.
     */
    public Document getOrderDashboardMetrics() {
        FacetOperation facetStage = Aggregation.facet(
            // Pipeline 1: Status distribution
            Aggregation.group("status").count().as("count"),
            Aggregation.project("count").and("_id").as("status")
        ).as("statusDistribution")
        .and(
            // Pipeline 2: Order Price Buckets
            Aggregation.bucket("total_amount")
                .withBoundaries(0, 50, 200, 500, 1000, 10000)
                .withDefaultBucket("other")
                .andOutputCount().as("orderCount")
        ).as("priceTierBuckets");

        Aggregation aggregation = Aggregation.newAggregation(facetStage);

        AggregationResults<Document> results = mongoTemplate.aggregate(
            aggregation,
            "orders",
            Document.class
        );

        return results.getUniqueMappedResult();
    }
}
```

---

### Type-Safe Aggregation Results Mapping

Spring Data MongoDB automates mapping BSON result documents into domain DTOs using converters registered in `MongoMappingContext`.

```java
package com.example.mongodb.domain.dto;

import java.math.BigDecimal;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SkuSalesMetric {

    @Id
    private String sku;

    @Field("product_name")
    private String productName;

    @Field("total_units_sold")
    private long totalUnitsSold;

    @Field("total_revenue")
    private BigDecimal totalRevenue;
}
```

---

### Atomic Operations, Counters, Upserts & Array Updates

MongoDB guarantees atomicity at the single-document level. Always prefer atomic updates over Read-Modify-Write cycles.

```java
package com.example.mongodb.repository;

import java.math.BigDecimal;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import com.example.mongodb.domain.model.OrderDocument;
import com.example.mongodb.domain.model.OrderItem;
import com.example.mongodb.domain.model.OrderStatus;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class OrderCommandRepository {

    private final MongoTemplate mongoTemplate;

    /**
     * Atomic Status Transition with Condition Guard (Prevents race conditions)
     */
    public boolean transitionStatus(String orderId, OrderStatus currentStatus, OrderStatus newStatus) {
        Query query = new Query(
            Criteria.where("_id").is(orderId)
                    .and("status").is(currentStatus)
        );

        Update update = new Update()
            .set("status", newStatus)
            .currentDate("updated_at");

        UpdateResult result = mongoTemplate.updateFirst(query, update, OrderDocument.class);
        return result.getModifiedCount() > 0;
    }

    /**
     * Atomic Counter Increment ($inc) and Upsert
     */
    public long incrementInventory(String sku, int quantityChange) {
        Query query = new Query(Criteria.where("sku").is(sku));
        Update update = new Update()
            .inc("available_stock", quantityChange)
            .currentDate("last_updated");

        FindAndModifyOptions options = FindAndModifyOptions.options()
            .returnNew(true)
            .upsert(true);

        Document updated = mongoTemplate.findAndModify(
            query, 
            update, 
            options, 
            Document.class, 
            "inventory"
        );

        return updated.getInteger("available_stock", 0);
    }

    /**
     * Array Atomic Operations: $push, $pull, $addToSet
     */
    public void appendItemToOrder(String orderId, OrderItem item) {
        Query query = new Query(Criteria.where("_id").is(orderId));
        
        Update update = new Update()
            // $push: append item to the end of the array
            .push("items", item)
            // $inc: update total amount atomically in same operation
            .inc("total_amount", item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())));

        mongoTemplate.updateFirst(query, update, OrderDocument.class);
    }

    public void removeItemFromOrder(String orderId, String sku) {
        Query query = new Query(Criteria.where("_id").is(orderId));
        
        // $pull: removes all elements matching the criteria from the array
        Update update = new Update()
            .pull("items", Query.query(Criteria.where("sku").is(sku)));

        mongoTemplate.updateFirst(query, update, OrderDocument.class);
    }

    public void addTagUnique(String orderId, String tag) {
        Query query = new Query(Criteria.where("_id").is(orderId));
        
        // $addToSet: adds value to array only if it does not already exist (Set semantics)
        Update update = new Update().addToSet("tags", tag);

        mongoTemplate.updateFirst(query, update, OrderDocument.class);
    }
}
```

---

## 4. Transactions & Performance Tuning

### Multi-Document Transactions & `MongoTransactionManager`

Multi-document ACID transactions are supported across replica sets and sharded clusters (WiredTiger engine).

#### 1. Configuration

```java
package com.example.mongodb.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
@EnableTransactionManagement
public class MongoTransactionConfig {

    /**
     * Registers the MongoTransactionManager required for @Transactional support.
     * Requires standalone MongoDB instances to be configured as single-node replica sets.
     */
    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        return new MongoTransactionManager(dbFactory);
    }
}
```

#### 2. Declarative & Programmatic Transactions

```java
package com.example.mongodb.service;

import java.math.BigDecimal;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import com.example.mongodb.domain.model.OrderDocument;
import com.example.mongodb.domain.model.OrderStatus;
import com.example.mongodb.repository.OrderCommandRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CheckoutService {

    private final MongoTemplate mongoTemplate;
    private final OrderCommandRepository orderCommandRepository;
    private final MongoTransactionManager transactionManager;

    /**
     * Declarative @Transactional:
     * - MongoDB transactions support Snapshot isolation.
     * - Default timeout: 60 seconds (WiredTiger transaction limit).
     */
    @Transactional(rollbackFor = Exception.class, timeout = 30)
    public OrderDocument completeCheckout(OrderDocument order) {
        order.setStatus(OrderStatus.CONFIRMED);
        OrderDocument savedOrder = mongoTemplate.save(order);

        order.getItems().forEach(item -> {
            long remaining = orderCommandRepository.incrementInventory(item.getSku(), -item.getQuantity());
            if (remaining < 0) {
                throw new IllegalStateException("Insufficient inventory for SKU: " + item.getSku());
            }
        });

        return savedOrder;
    }

    /**
     * Programmatic Transaction using TransactionTemplate
     */
    public void executeTransactionalLogic(Runnable action) {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.executeWithoutResult(status -> action.run());
    }
}
```

---

### MongoClientSettings & Connection Pool Tuning

Tuning connection pooling avoids connection exhaustion, excessive thread context switching, and socket timeouts under high load.

```java
package com.example.mongodb.config;

import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.ReadConcern;
import com.mongodb.ReadPreference;
import com.mongodb.WriteConcern;
import com.mongodb.connection.ConnectionPoolSettings;
import com.mongodb.connection.SocketSettings;

@Configuration
public class MongoClientConfig {

    @Value("${spring.data.mongodb.uri}")
    private String connectionUri;

    @Bean
    public MongoClientSettingsBuilderCustomizer mongoClientSettingsCustomizer() {
        return clientSettingsBuilder -> {
            ConnectionString connectionString = new ConnectionString(connectionUri);

            clientSettingsBuilder
                .applyConnectionString(connectionString)
                .applyToConnectionPoolSettings(builder -> builder
                    .maxSize(100)                     // Max pooled connections per node
                    .minSize(10)                      // Keep minimum warm connections
                    .maxWaitTime(2000, TimeUnit.MILLISECONDS) // Max wait for an available connection
                    .maxConnectionIdleTime(60000, TimeUnit.MILLISECONDS) // Close connections idle for > 60s
                    .maxConnectionLifeTime(30, TimeUnit.MINUTES)         // Max lifespan to avoid memory leaks
                )
                .applyToSocketSettings(builder -> builder
                    .connectTimeout(5000, TimeUnit.MILLISECONDS)   // TCP connect timeout
                    .readTimeout(10000, TimeUnit.MILLISECONDS)    // Socket read/query timeout
                )
                .applyToClusterSettings(builder -> builder
                    .serverSelectionTimeout(5000, TimeUnit.MILLISECONDS) // Fail-fast on primary failover
                )
                .writeConcern(WriteConcern.MAJORITY.withJournal(true))
                .readPreference(ReadPreference.secondaryPreferred())
                .readConcern(ReadConcern.MAJORITY);
        };
    }
}
```

---

### Write Concerns & Read Preferences

#### Write Concerns

| Write Concern                      | Durability Guarantee                         | Latency    | Recommended Use Case                         |
| :--------------------------------- | :------------------------------------------- | :--------- | :------------------------------------------- |
| `WriteConcern.W1` / `ACKNOWLEDGED` | Primary acknowledged in memory               | Lowest     | Non-critical logs, metrics                   |
| `WriteConcern.MAJORITY`            | Majority of replica set members acknowledged | Low-Medium | Production business data (Financial, Orders) |
| `WriteConcern.JOURNALED`           | Primary wrote to disk journal before ack     | Medium     | Zero data-loss tolerance on power failure    |

#### Read Preferences

| Read Preference                       | Target Nodes                   | Failover Behavior              | Use Case                                |
| :------------------------------------ | :----------------------------- | :----------------------------- | :-------------------------------------- |
| `ReadPreference.primary()`            | Primary only                   | Fails if primary is down       | Strong read-your-own-writes consistency |
| `ReadPreference.primaryPreferred()`   | Primary; fallback to Secondary | Read-available during election | Balanced consistency                    |
| `ReadPreference.secondaryPreferred()` | Secondary; fallback to Primary | High availability              | Reporting, Analytics, Dashboards        |
| `ReadPreference.nearest()`            | Lowest network latency node    | Reads from closest node        | Multi-region read routing               |

---

## 5. Common Pitfalls & Anti-Patterns

### Treating MongoDB Like SQL (Embedding vs Referencing)

#### ❌ Anti-Pattern: Over-Normalizing (SQL Schema in NoSQL)
Creating separate collections for every entity (e.g., `orders`, `order_lines`, `line_discounts`, `addresses`) and executing multiple application-level queries or heavy `$lookup` joins.

####  Best Practice: Embed Bounded, Model by Access Pattern
- **Embed** when child data is accessed together with the parent (e.g. Order Items in an Order, Address in a Customer) and life-cycle is 1:1 or 1:bounded-N.
- **Reference (DBRef / ID)** when relationships are unbounded (1:Millions), data is updated independently by multiple domains, or documents are shared across many contexts (e.g., `User` referenced by `Order.customerId`).

---

### Unindexed Collection Scans (COLLSCAN vs IXSCAN & ESR Rule)

#### ❌ Anti-Pattern: Missing Compound Index or Wrong Field Order
Querying with `{ tenantId: "T1", status: "PENDING" }` sorted by `{ createdAt: -1 }` without an index causes MongoDB to perform an in-memory sort (`SORT` stage) or complete collection scan (`COLLSCAN`).

####  Best Practice: The ESR Rule (Equality, Sort, Range)
When designing compound indexes, always order fields in the index key definition according to:
1. **E**quality: Exact match fields first (e.g., `tenantId`, `status`)
2. **S**ort: Sort order fields second (e.g., `createdAt: -1`)
3. **R**ange: Range filter fields last (e.g., `totalAmount: { $gt: 100 }`)

```java
// Correct Compound Index matching ESR:
@CompoundIndex(
    name = "idx_esr_order",
    def = "{ 'tenantId': 1, 'status': 1, 'createdAt': -1, 'totalAmount': 1 }"
)
```

#### Verifying with Query Execution Plan (`explain`)

```java
Document explainPlan = mongoTemplate.getDb()
    .getCollection("orders")
    .find(new Document("status", "CONFIRMED"))
    .explain("executionStats");
// Inspect explainPlan -> executionStats -> executionStages -> stage == "IXSCAN" (not "COLLSCAN")
```

---

### Unbounded Arrays & 16MB BSON Document Limit

#### ❌ Anti-Pattern: Unbounded Array Growth
```java
// DANGEROUS: Pushing log entries or telemetry indefinitely into a single document
@Document(collection = "users")
public class UserDocument {
    @Id private String id;
    private List<UserActivityLog> activityHistory; // Grows infinitely -> Exceeds 16MB limit!
}
```
*Consequences:*
1. MongoDB hard limit: Single BSON document cannot exceed **16MB**.
2. Document relocation and fragmentation: Growing arrays force WiredTiger to constantly reallocate disk blocks, causing major latency spikes.

####  Best Practice: Bucket Pattern or Separate Collections
- Store unbounded events in a dedicated `user_activity_logs` collection with `{ userId: "...", timestamp: Instant }`.
- Or use the **Bucket Pattern** (grouping 100 or 500 events per document).

---

### Transaction Overuse in Document Databases

#### ❌ Anti-Pattern: Wrapping Every Service Method in `@Transactional`
Unlike RDBMS, MongoDB transactions:
- Incur significant coordinator overhead across replica set members.
- Lock WiredTiger cache tickets, limiting throughput under high concurrency.
- Enforce a strict 60-second execution window.

####  Best Practice: Design for Single-Document Atomicity
Because MongoDB guarantees atomic updates for individual documents (including embedded arrays and nested fields), model your root aggregates so that most business operations modify a **single document atomically** using `updateFirst` / `findAndModify` with `$set`, `$inc`, `$push`, and `$pull`. Reserve multi-document `@Transactional` only for cross-collection invariants (e.g. money transfers between two distinct accounts).

---

## Quick Reference Summary

| Concern                | Primary Tool / Class      | Configuration / Annotation                                     |
| :--------------------- | :------------------------ | :------------------------------------------------------------- |
| **Document Identity**  | String / ObjectId / UUID  | `@Id`                                                          |
| **Field Mapping**      | BSON Field Customization  | `@Field(name = "...", targetType = ...)`                       |
| **Indexing**           | Background, Compound, TTL | `@CompoundIndex`, `@Indexed`, `@TextIndexed`                   |
| **Index Control**      | Production Safety         | `spring.data.mongodb.auto-index-creation=false`                |
| **Auditing**           | Auto timestamps / User    | `@EnableMongoAuditing`, `@CreatedDate`, `@LastModifiedDate`    |
| **CRUD & Queries**     | High-level Repository     | `MongoRepository<T, ID>`, `@Query`                             |
| **Dynamic Filters**    | Dynamic Criteria Builder  | `MongoTemplate.find(Query.addCriteria(...))`                   |
| **Aggregations**       | Multi-stage Pipeline      | `Aggregation.newAggregation(...)`                              |
| **Atomic Mutations**   | Single-Document Atomicity | `mongoTemplate.updateFirst(query, update)` / `findAndModify`   |
| **Transactions**       | Multi-Document ACID       | `@Transactional`, `MongoTransactionManager`                    |
| **Connection Pool**    | Socket & Thread Tuning    | `MongoClientSettingsBuilderCustomizer`                         |
| **Durability & Route** | Data Safety & Read Load   | `WriteConcern.MAJORITY`, `ReadPreference.secondaryPreferred()` |

