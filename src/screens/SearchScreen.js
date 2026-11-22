import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TextInput,
  Button,
  Card,
  Text,
  HelperText,
} from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@cep_history';

export default function SearchScreen({ route }) {
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [region, setRegion] = useState({
    latitude: -8.0476,
    longitude: -34.8770,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const [markerCoords, setMarkerCoords] = useState({
    latitude: -8.0476,
    longitude: -34.8770,
  });

  useEffect(() => {
    const selectedItem = route?.params?.selectedItem;
    if (selectedItem && selectedItem.latitude && selectedItem.longitude) {
      setAddress({
        logradouro: selectedItem.logradouro,
        bairro: selectedItem.bairro,
        localidade: selectedItem.localidade,
        uf: selectedItem.uf,
        cep: selectedItem.cep,
      });
      setCep(selectedItem.cep && selectedItem.cep !== 'Não disponível' ? selectedItem.cep : '');
      setMarkerCoords({
        latitude: selectedItem.latitude,
        longitude: selectedItem.longitude,
      });
      setRegion({
        latitude: selectedItem.latitude,
        longitude: selectedItem.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setError('');
    }
  }, [route?.params?.selectedItem]);

  const saveToHistory = async (newAddress) => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const currentHistory = stored ? JSON.parse(stored) : [];
      const filtered = currentHistory.filter(
        (item) =>
          item.cep !== newAddress.cep ||
          newAddress.cep === 'Não disponível' ||
          newAddress.cep === '-'
      );
      const updatedHistory = [newAddress, ...filtered].slice(0, 15);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (err) {
      console.error('Erro ao salvar histórico:', err);
    }
  };

  const handleCepChange = (text) => {
    const numericValue = text.replace(/\D/g, '').slice(0, 8);
    let formattedCep = numericValue;
    if (numericValue.length > 5) {
      formattedCep = `${numericValue.slice(0, 5)}-${numericValue.slice(5)}`;
    }
    setCep(formattedCep);
    if (error) setError('');
  };

  const handleSearchCep = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setError('Digite um CEP válido completo com 8 dígitos.');
      return;
    }

    setError('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      const responseCep = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const dataCep = await responseCep.json();

      if (dataCep.erro) {
        setError('CEP não encontrado na base do ViaCEP.');
        setAddress(null);
        setLoading(false);
        return;
      }

      const query = `${dataCep.logradouro ? dataCep.logradouro + ', ' : ''}${dataCep.bairro ? dataCep.bairro + ', ' : ''}${dataCep.localidade}, ${dataCep.uf}, Brasil`;
      const responseGeo = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
        {
          headers: { 'User-Agent': 'BuscadorCepSenacRecife/1.0' },
        }
      );
      const dataGeo = await responseGeo.json();

      if (dataGeo && dataGeo.length > 0) {
        const lat = parseFloat(dataGeo[0].lat);
        const lon = parseFloat(dataGeo[0].lon);

        const formattedAddress = {
          id: `${Date.now()}`,
          logradouro: dataCep.logradouro || 'Não informado',
          bairro: dataCep.bairro || 'Não informado',
          localidade: dataCep.localidade,
          uf: dataCep.uf,
          cep: dataCep.cep,
          latitude: lat,
          longitude: lon,
          consultadoEm: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setAddress(formattedAddress);
        await saveToHistory(formattedAddress);

        setRegion({
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setMarkerCoords({ latitude: lat, longitude: lon });
      } else {
        setError('Endereço localizado, mas coordenadas não encontradas no mapa.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao consultar o CEP ou as coordenadas.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = async (event) => {
    const coords = event.nativeEvent.coordinate;
    setMarkerCoords({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
        {
          headers: { 'User-Agent': 'BuscadorCepSenacRecife/1.0' },
        }
      );
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const clickedAddress = {
          id: `${Date.now()}`,
          logradouro:
            addr.road || addr.pedestrian || addr.suburb || 'Local selecionado no mapa',
          bairro:
            addr.suburb || addr.neighbourhood || addr.city_district || 'Bairro não informado',
          localidade:
            addr.city || addr.town || addr.village || addr.municipality || 'Cidade desconhecida',
          uf: addr.state ? addr.state.substring(0, 2).toUpperCase() : 'UF',
          cep: addr.postcode || 'Não disponível',
          latitude: coords.latitude,
          longitude: coords.longitude,
          consultadoEm: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setAddress(clickedAddress);
        await saveToHistory(clickedAddress);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao obter endereço pelo toque no mapa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.searchRow}>
        <TextInput
          mode="outlined"
          label="CEP (00000-000)"
          placeholder="Ex: 50030-230"
          keyboardType="numeric"
          maxLength={9}
          value={cep}
          onChangeText={handleCepChange}
          style={styles.input}
          left={<TextInput.Icon icon="map-marker" />}
        />
        <Button
          mode="contained"
          onPress={handleSearchCep}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Buscar
        </Button>
      </View>

      {error ? (
        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>
      ) : null}

      {loading && (
        <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
      )}

      {address && !loading && (
        <Card mode="elevated" style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Endereço Selecionado
            </Text>
            <Text variant="bodyMedium">
              <Text style={styles.bold}>Rua:</Text> {address.logradouro}
            </Text>
            <Text variant="bodyMedium">
              <Text style={styles.bold}>Bairro:</Text> {address.bairro}
            </Text>
            <Text variant="bodyMedium">
              <Text style={styles.bold}>Cidade/UF:</Text> {address.localidade} - {address.uf}
            </Text>
            <Text variant="bodyMedium">
              <Text style={styles.bold}>CEP:</Text> {address.cep}
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          region={region}
          onRegionChangeComplete={(reg) => setRegion(reg)}
          onPress={handleMapPress}
        >
          <Marker
            coordinate={markerCoords}
            title={address ? `${address.localidade} - ${address.uf}` : 'Ponto Selecionado'}
            description={address ? address.logradouro : 'Toque no mapa para consultar'}
          />
        </MapView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
  },
  button: {
    borderRadius: 8,
    marginTop: 4,
  },
  buttonContent: {
    height: 48,
    paddingHorizontal: 6,
  },
  loader: {
    marginVertical: 6,
  },
  card: {
    marginVertical: 8,
    backgroundColor: '#fff',
  },
  cardTitle: {
    color: '#007AFF',
    fontWeight: '700',
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});