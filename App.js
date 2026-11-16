import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ActivityIndicator, Keyboard, FlatList, Modal, SafeAreaView, Platform, StatusBar 
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

  // Região inicial: Visão geral do Brasil
  const [region, setRegion] = useState({
    latitude: -14.2350,
    longitude: -51.9253,
    latitudeDelta: 25,
    longitudeDelta: 25,
  });

  const [markerCoords, setMarkerCoords] = useState({
    latitude: -14.2350,
    longitude: -51.9253,
  });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('@cep_history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  const saveToHistory = async (newAddress) => {
    try {
      const filtered = history.filter(item => item.cep !== newAddress.cep || item.cep === '-');
      const updatedHistory = [newAddress, ...filtered].slice(0, 10);

      setHistory(updatedHistory);
      await AsyncStorage.setItem('@cep_history', JSON.stringify(updatedHistory));
    } catch (err) {
      console.error('Erro ao salvar histórico:', err);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem('@cep_history');
      setHistory([]);
    } catch (err) {
      console.error('Erro ao limpar histórico:', err);
    }
  };

  // Função com máscara automática de CEP (00000-000)
  const handleCepChange = (text) => {
    const numericValue = text.replace(/\D/g, '');
    const limitedValue = numericValue.slice(0, 8);

    let formattedCep = limitedValue;
    if (limitedValue.length > 5) {
      formattedCep = `${limitedValue.slice(0, 5)}-${limitedValue.slice(5)}`.trim();
    }

    setCep(formattedCep);
    if (error) setError('');
  };

  // Selecionar item do histórico e recarregar o mapa
  const handleSelectHistoryItem = (item) => {
    setAddress({
      logradouro: item.logradouro,
      bairro: item.bairro,
      localidade: item.localidade,
      uf: item.uf,
      cep: item.cep,
    });
    setMarkerCoords({
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setIsHistoryModalVisible(false);
  };

  // Buscar via CEP digitado
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
        setError('CEP não encontrado.');
        setAddress(null);
        setLoading(false);
        return;
      }

      const query = `${dataCep.logradouro ? dataCep.logradouro + ', ' : ''}${dataCep.bairro ? dataCep.bairro + ', ' : ''}${dataCep.localidade}, ${dataCep.uf}, Brasil`;
      const responseGeo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'AppConsultaCepExpo/1.0' },
      });
      const dataGeo = await responseGeo.json();

      if (dataGeo && dataGeo.length > 0) {
        const lat = parseFloat(dataGeo[0].lat);
        const lon = parseFloat(dataGeo[0].lon);

        const formattedAddress = {
          logradouro: dataCep.logradouro || 'Não informado',
          bairro: dataCep.bairro || 'Não informado',
          localidade: dataCep.localidade,
          uf: dataCep.uf,
          cep: dataCep.cep,
          latitude: lat,
          longitude: lon,
        };

        setAddress(formattedAddress);
        saveToHistory(formattedAddress);

        setRegion({
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setMarkerCoords({ latitude: lat, longitude: lon });
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar o CEP ou as coordenadas.');
    } finally {
      setLoading(false);
    }
  };

  // Toque no mapa (Geocodificação Reversa)
  const handleMapPress = async (event) => {
    const coords = event.nativeEvent.coordinate;
    setMarkerCoords({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`, {
        headers: { 'User-Agent': 'AppConsultaCepExpo/1.0' },
      });
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const clickedAddress = {
          logradouro: addr.road || addr.pedestrian || addr.suburb || 'Local personalizado',
          bairro: addr.suburb || addr.neighbourhood || addr.city_district || 'Bairro não informado',
          localidade: addr.city || addr.town || addr.village || addr.municipality || 'Cidade desconhecida',
          uf: addr.state ? addr.state.substring(0, 2).toUpperCase() : 'UF',
          cep: addr.postcode || 'Não disponível',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setAddress(clickedAddress);
        saveToHistory(clickedAddress);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar endereço do ponto selecionado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📍 Buscador de CEP</Text>
        <TouchableOpacity 
          style={styles.historyButtonHeader} 
          onPress={() => setIsHistoryModalVisible(true)}
        >
          <Text style={styles.historyButtonText}>Histórico ({history.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Campo de Busca com Máscara */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.input}
          placeholder="Digite o CEP (ex: 50030-230)"
          placeholderTextColor="#999"
          keyboardType="numeric"
          maxLength={9}
          value={cep}
          onChangeText={handleCepChange}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchCep}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 6 }} />}

      {/* Card de Informações */}
      {address && !loading && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Endereço Selecionado</Text>
          <Text style={styles.textItem}><Text style={styles.bold}>Rua:</Text> {address.logradouro}</Text>
          <Text style={styles.textItem}><Text style={styles.bold}>Bairro:</Text> {address.bairro}</Text>
          <Text style={styles.textItem}><Text style={styles.bold}>Cidade/UF:</Text> {address.localidade} - {address.uf}</Text>
          <Text style={styles.textItem}><Text style={styles.bold}>CEP:</Text> {address.cep}</Text>
        </View>
      )}

      {/* Mapa */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={region}
          onRegionChangeComplete={(reg) => setRegion(reg)}
          onPress={handleMapPress}
        >
          <Marker
            coordinate={markerCoords}
            title={address ? `${address.localidade} - ${address.uf}` : "Ponto Selecionado"}
            description={address ? address.logradouro : "Toque no mapa"}
          />
        </MapView>
      </View>

      {/* Modal / Aba Lateral de Histórico */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isHistoryModalVisible}
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📜 Histórico de Buscas</Text>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                <Text style={styles.closeButtonText}>✕ Fechar</Text>
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <Text style={styles.emptyHistoryText}>Nenhum endereço pesquisado ainda.</Text>
            ) : (
              <>
                <FlatList
                  data={history}
                  keyExtractor={(item, index) => index.toString()}
                  contentContainerStyle={styles.modalList}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.historyItemCard} 
                      onPress={() => handleSelectHistoryItem(item)}
                    >
                      <View style={styles.historyItemRow}>
                        <Text style={styles.historyItemCep}>{item.cep}</Text>
                        <Text style={styles.historyItemCity}>{item.localidade} - {item.uf}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.historyItemStreet}>{item.logradouro}, {item.bairro}</Text>
                    </TouchableOpacity>
                  )}
                />

                <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
                  <Text style={styles.clearButtonText}>🗑️ Limpar Histórico</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 10 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  historyButtonHeader: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
    height: 46,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  errorText: {
    color: '#dc3545',
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 6,
    color: '#007AFF',
  },
  textItem: {
    fontSize: 13,
    color: '#495057',
    marginBottom: 2,
  },
  bold: {
    fontWeight: 'bold',
    color: '#212529',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    height: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: '600',
  },
  emptyHistoryText: {
    textAlign: 'center',
    color: '#6c757d',
    marginTop: 40,
    fontSize: 15,
  },
  modalList: {
    paddingBottom: 10,
  },
  historyItemCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  historyItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyItemCep: {
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 14,
  },
  historyItemCity: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  historyItemStreet: {
    fontSize: 13,
    color: '#495057',
  },
  clearButton: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  clearButtonText: {
    color: '#dc3545',
    fontWeight: 'bold',
    fontSize: 14,
  },
});