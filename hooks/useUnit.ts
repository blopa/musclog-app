import {
    FEET,
    KILOGRAMS,
    METERS,
    METRIC_SYSTEM,
    POUNDS,
    UNIT_CHOICE_TYPE,
} from '@/constants/storage';
import { useLayoutReloader } from '@/storage/LayoutReloaderProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useEffect, useState } from 'react';

const useUnit = () => {
    const [unitSystem, setUnitSystem] = useState(METRIC_SYSTEM);
    const { reloadKey } = useLayoutReloader();
    const { getSettingByType, settings } = useSettings();

    useEffect(() => {
        const fetchUnit = async () => {
            const unit = await getSettingByType(UNIT_CHOICE_TYPE);
            setUnitSystem(unit?.value || METRIC_SYSTEM);
        };

        fetchUnit();
    }, [reloadKey, getSettingByType, settings]);

    return {
        heightUnit: unitSystem === METRIC_SYSTEM ? METERS : FEET,
        unitSystem,
        weightUnit: unitSystem === METRIC_SYSTEM ? KILOGRAMS : POUNDS,
    };
};

export default useUnit;
