import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/media/data/media_repository.dart';

final Provider<MediaRepository> mediaRepositoryProvider =
    Provider<MediaRepository>((Ref ref) => MediaRepository(ref.watch(apiClientProvider)));
