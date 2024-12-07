import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { deleteUserMeasurements, getTotalUserMeasurementsCount, getUserMeasurementsPaginated } from '@/utils/database';
import { formatDate } from '@/utils/date';
import { UserMeasurementsReturnType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme } from 'react-native-paper';

export default function ListUserMeasurements({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [userMeasurements, setUserMeasurements] = useState<UserMeasurementsReturnType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [measurementToDelete, setMeasurementToDelete] = useState<null | number>(null);
    const [totalUserMeasurementsCount, setTotalUserMeasurementsCount] = useState(0);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [searchQuery, setSearchQuery] = useState('');

    const loadUserMeasurements = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedUserMeasurements = await getUserMeasurementsPaginated(offset, limit);

            setUserMeasurements((prevState) => {
                const combinedData = [
                    ...prevState,
                    ...loadedUserMeasurements.filter(
                        (data) => !prevState.some((prevData) => prevData.id === data.id)
                    ),
                ];

                combinedData.sort((a, b) => {
                    if (a.date < b.date) {
                        return 1;
                    }

                    if (a.date > b.date) {
                        return -1;
                    }

                    if (a?.id! < b?.id!) {
                        return 1;
                    }

                    if (a?.id! > b?.id!) {
                        return -1;
                    }

                    return 0;
                });

                return combinedData;
            });
        } catch (error) {
            console.error('Failed to load user measurements:', error);
        }
    }, []);

    const loadMoreUserMeasurements = useCallback(() => {
        if (userMeasurements.length >= totalUserMeasurementsCount) {
            return;
        }

        loadUserMeasurements(userMeasurements.length);
    }, [userMeasurements.length, totalUserMeasurementsCount, loadUserMeasurements]);

    const fetchTotalUserMeasurementsCount = useCallback(async () => {
        const totalCount = await getTotalUserMeasurementsCount();
        setTotalUserMeasurementsCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setUserMeasurements([]);
        setIsDeleteModalVisible(false);
        setMeasurementToDelete(null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalUserMeasurementsCount();
            loadUserMeasurements();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalUserMeasurementsCount, loadUserMeasurements, resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('userMeasurementsCharts');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleDeleteMeasurement = useCallback(async (id: number) => {
        setMeasurementToDelete(id);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirmation = useCallback(async () => {
        if (measurementToDelete) {
            try {
                await deleteUserMeasurements(measurementToDelete);
                const updatedUserMeasurements = userMeasurements.filter((measurement) => measurement.id !== measurementToDelete);
                setUserMeasurements(updatedUserMeasurements);
                setIsDeleteModalVisible(false);
                setMeasurementToDelete(null);
                setTotalUserMeasurementsCount((prevState) => prevState - 1);
            } catch (error) {
                console.error('Failed to delete user measurement:', error);
            }
        }
    }, [measurementToDelete, userMeasurements]);

    const handleDeleteCancel = useCallback(() => {
        setIsDeleteModalVisible(false);
        setMeasurementToDelete(null);
    }, []);

    const filteredUserMeasurements = useMemo(() => userMeasurements.filter((measurement) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            measurement.date?.toLowerCase().includes(searchLower)
            || Object.entries(measurement.measurements).map(([key, value]) => `${key}: ${value}`)
                .join(', ')
                .toLowerCase()
                .includes(searchLower)
        );
    }), [userMeasurements, searchQuery]);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_user_measurements'),
            onPress: () => navigation.navigate('createUserMeasurements'),
            style: { backgroundColor: colors.surface },
        }];

        return actions;
    }, [t, colors.surface, colors.primary, navigation]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('user_measurements')} titleStyle={styles.appbarTitle} />
                        <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    </Appbar.Header>
                    <FlashList
                        contentContainerStyle={styles.scrollViewContent}
                        data={filteredUserMeasurements}
                        estimatedItemSize={95}
                        keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                        ListFooterComponent={userMeasurements.length < totalUserMeasurementsCount ? <ActivityIndicator /> : null}
                        onEndReached={loadMoreUserMeasurements}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item: measurement }) => (
                            <ThemedCard key={measurement.id}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{formatDate(measurement.date || measurement.createdAt || '')}</Text>
                                        {Object.entries(measurement.measurements).map(([key, value]) => {
                                            return (
                                                <Text key={key} style={styles.metricDetailText}>
                                                    {key}: {value}
                                                </Text>
                                            );
                                        })}
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={() => navigation.navigate('createUserMeasurements', { id: measurement.id })}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="trash"
                                            onPress={() => handleDeleteMeasurement(measurement.id!)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </Card.Content>
                            </ThemedCard>
                        )}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={handleDeleteCancel}
                        onConfirm={handleDeleteConfirmation}
                        title={t('delete_confirmation_generic', {
                            title: userMeasurements.find((measurement) => measurement.id === measurementToDelete)?.userId,
                        })}
                        visible={isDeleteModalVisible}
                    />
                </View>
            </FABWrapper>
        </Screen>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: 20,
    },
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: 8,
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardHeader: {
        flex: 1,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    metricDetailText: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    scrollViewContent: {
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
});
