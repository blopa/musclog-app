import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';

import DatePickerModal from './DatePickerModal';

type FiltersProps = {
    aggregatedValuesLabel: string;
    endDate?: Date;
    setEndDate?: (date: Date) => void;
    setShowAggregatedValues: (value: boolean) => void;
    setStartDate?: (date: Date) => void;
    setTimeRange: (value: string) => void;
    showAggregatedValues: boolean;
    showAggregateSwitch?: boolean;
    showDateRange?: boolean;
    startDate?: Date;
    timeRange: string;
};

const Filters = ({
    aggregatedValuesLabel,
    endDate,
    setEndDate,
    setShowAggregatedValues,
    setStartDate,
    setTimeRange,
    showAggregatedValues,
    showAggregateSwitch = true,
    showDateRange = false,
    startDate,
    timeRange,
}: FiltersProps) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
    const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

    const handleStartDateChange = useCallback((date: Date) => {
        if (setStartDate) {
            setStartDate(date);
        }
    }, [setStartDate]);

    const handleEndDateChange = useCallback((date: Date) => {
        if (setEndDate) {
            setEndDate(date);
        }
    }, [setEndDate]);

    return (
        <View style={styles.filtersContainer}>
            <ScrollView contentContainerStyle={styles.horizontalScrollView} horizontal>
                <View style={styles.filterItem}>
                    <Text style={styles.filterLabel}>
                        {t('show_last_n_data_points')}
                    </Text>
                    <SegmentedButtons
                        buttons={[
                            { label: '7', value: '7' },
                            { label: '30', value: '30' },
                            { label: '90', value: '90' },
                            // { label: t('all'), value: '365' },
                            { label: '365', value: '365' },
                        ]}
                        onValueChange={setTimeRange}
                        style={styles.segmentedButtons}
                        value={timeRange}
                    />
                </View>
                {showAggregateSwitch ? (
                    <View style={styles.filterItem}>
                        <Text style={styles.filterLabel}>
                            {aggregatedValuesLabel}
                        </Text>
                        <Switch
                            onValueChange={() => setShowAggregatedValues(!showAggregatedValues)}
                            style={styles.switch}
                            value={showAggregatedValues}
                        />
                    </View>
                ) : null}
                {showDateRange && (
                    <>
                        <View style={styles.filterItem}>
                            <Text style={styles.filterLabel}>
                                {t('start_date')}
                            </Text>
                            <Button onPress={() => setStartDatePickerVisible(true)}>
                                {startDate ? startDate.toLocaleDateString() : t('select_date')}
                            </Button>
                        </View>
                        <View style={styles.filterItem}>
                            <Text style={styles.filterLabel}>
                                {t('end_date')}
                            </Text>
                            <Button onPress={() => setEndDatePickerVisible(true)}>
                                {endDate ? endDate.toLocaleDateString() : t('select_date')}
                            </Button>
                        </View>
                        <DatePickerModal
                            onChangeDate={handleStartDateChange}
                            onClose={() => setStartDatePickerVisible(false)}
                            selectedDate={startDate || new Date()}
                            visible={startDatePickerVisible}
                        />
                        <DatePickerModal
                            onChangeDate={handleEndDateChange}
                            onClose={() => setEndDatePickerVisible(false)}
                            selectedDate={endDate || new Date()}
                            visible={endDatePickerVisible}
                        />
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    filterItem: {
        alignItems: 'center',
        marginHorizontal: 8,
    },
    filterLabel: {
        marginBottom: 8,
        textAlign: 'center',
    },
    filtersContainer: {
        paddingHorizontal: 16,
    },
    horizontalScrollView: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    segmentedButtons: {
        width: '100%',
    },
    switch: {
        marginLeft: 12,
    },
});

export default Filters;
