const { format, parseISO } = require('date-fns');
const { enUS } = require('date-fns/locale');

console.log(format(parseISO('2024-06-25T07:21:00Z'), 'yyyy-MM-dd', {
    locale: enUS,
}));

