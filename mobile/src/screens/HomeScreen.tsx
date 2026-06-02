import React from "react";
import { View, Text, Button, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Home</Text>
            <Button title="Go to settings" onPress={() => navigation.navigate('Settings')} />
        </View>
    );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
},
  title: { 
    fontSize: 24, 
    marginBottom: 16 },
});