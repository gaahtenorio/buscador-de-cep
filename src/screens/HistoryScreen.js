import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card, Text, Button, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@cep_history';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setHistory(stored ? JSON.parse(stored) : []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const handleClearHistory = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setHistory([]);
    } catch (err) {
      console.error('Erro ao limpar histórico:', err);
    }
  };

  const handleSelectItem = (item) => {
    navigation.navigate('Buscar', { selectedItem: item });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Nenhuma busca salva ainda
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            Consulte um CEP ou toque em um ponto no mapa para registrar aqui.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={history}
            keyExtractor={(item, index) => item.id || `${item.cep}-${index}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card
                mode="outlined"
                style={styles.itemCard}
                onPress={() => handleSelectItem(item)}
              >
                <Card.Content>
                  <View style={styles.itemHeader}>
                    <Text variant="titleSmall" style={styles.cepText}>
                      {item.cep}
                    </Text>
                    <Text variant="bodySmall" style={styles.cityText}>
                      {item.localidade} - {item.uf}
                    </Text>
                  </View>
                  <Divider style={styles.divider} />
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {item.logradouro}
                  </Text>
                  <Text variant="bodySmall" style={styles.subText}>
                    Bairro: {item.bairro}
                    {item.consultadoEm ? ` • ${item.consultadoEm}` : ''}
                  </Text>
                </Card.Content>
              </Card>
            )}
          />

          <Button
            mode="outlined"
            icon="delete-outline"
            textColor="#dc3545"
            onPress={handleClearHistory}
            style={styles.clearButton}
          >
            Limpar Histórico
          </Button>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#6c757d',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 12,
  },
  itemCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cepText: {
    fontWeight: '700',
    color: '#007AFF',
  },
  cityText: {
    color: '#495057',
  },
  divider: {
    marginVertical: 6,
  },
  subText: {
    color: '#6c757d',
    marginTop: 2,
  },
  clearButton: {
    borderColor: '#dc3545',
    marginBottom: 12,
  },
});