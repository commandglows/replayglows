enum ProductEntitlementStatus {
  active,
  trialing,
  inactive,
  expired,
  refunded,
  revoked,
  pendingReview,
  unknown,
}

extension ProductEntitlementStatusAccess on ProductEntitlementStatus {
  bool get grantsAccess =>
      this == ProductEntitlementStatus.active ||
      this == ProductEntitlementStatus.trialing;
}

class ProductEntitlement {
  const ProductEntitlement({
    required this.productId,
    required this.status,
    this.plan,
    this.source,
    this.sourceRef,
    this.environment,
    this.updatedAt,
  });

  final String productId;
  final ProductEntitlementStatus status;
  final String? plan;
  final String? source;
  final String? sourceRef;
  final String? environment;
  final DateTime? updatedAt;

  bool get grantsAccess => status.grantsAccess;
}
