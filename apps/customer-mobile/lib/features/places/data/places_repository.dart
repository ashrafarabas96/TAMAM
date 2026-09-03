import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/features/places/domain/saved_place.dart';

/// CRUD for `/customers/me/places`.
class PlacesRepository {
  const PlacesRepository(this._api);

  final ApiClient _api;

  Future<List<SavedPlace>> list() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.places);
    return raw.map(SavedPlace.fromJson).toList(growable: false);
  }

  Future<SavedPlace> create(SavedPlace place) async =>
      SavedPlace.fromJson(await _api.postObject(ApiPaths.places, body: place.toRequestJson()));

  Future<SavedPlace> update(String id, SavedPlace place) async =>
      SavedPlace.fromJson(await _api.putObject(ApiPaths.place(id), body: place.toRequestJson()));

  Future<void> delete(String id) => _api.delete(ApiPaths.place(id));
}
