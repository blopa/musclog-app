const { RULES, scanFiles, scanSource } = require('../layout-risk-scan') as {
  RULES: Record<string, { weight: number; message: string }>;
  scanFiles: (directories?: string[]) => Array<{ file: string; score: number }>;
  scanSource: (
    source: string,
    fileName: string
  ) => {
    file: string;
    score: number;
    findings: Array<{ rule: string; weight: number; line: number; message: string }>;
  };
};

const rulesIn = (source: string) => scanSource(source, 'Sample.tsx').findings.map((f) => f.rule);

describe('row-text-no-shrink', () => {
  it('flags a row whose text can neither shrink nor truncate', () => {
    expect(
      rulesIn(`
        const A = () => (
          <View className="flex-row justify-between">
            <Text className="text-sm">Protein</Text>
            <Text className="text-sm">131.9/180g</Text>
          </View>
        );`)
    ).toEqual(['row-text-no-shrink']);
  });

  it('flags an icon beside text that nothing in the row can shrink', () => {
    expect(
      rulesIn(`const A = () => <View className="flex-row"><Icon /><Text>Label</Text></View>;`)
    ).toEqual(['row-text-no-shrink']);
  });

  it('accepts a row where a sibling absorbs the extra width', () => {
    expect(
      rulesIn(`
        const A = () => (
          <View className="flex-row">
            <Text className="flex-1">Protein</Text>
            <Text>131.9/180g</Text>
          </View>
        );`)
    ).toEqual([]);
  });

  it('accepts text that truncates, and rows that wrap', () => {
    expect(
      rulesIn(
        `const A = () => <View className="flex-row"><Icon /><Text numberOfLines={1}>Name</Text></View>;`
      )
    ).toEqual([]);
    expect(
      rulesIn(
        `const A = () => <View className="flex-row flex-wrap"><Icon /><Text>Name</Text></View>;`
      )
    ).toEqual([]);
  });

  it('reads className from a cn() call and a template literal', () => {
    expect(
      rulesIn(
        `const A = () => <View className={cn('flex-row', active && 'gap-2')}><Icon /><Text>x</Text></View>;`
      )
    ).toEqual(['row-text-no-shrink']);
    expect(
      rulesIn('const A = () => <View className={`flex-row ${gap}`}><Icon /><Text>x</Text></View>;')
    ).toEqual(['row-text-no-shrink']);
  });

  it('reads a flexDirection row from a style object', () => {
    expect(
      rulesIn(
        `const A = () => <View style={{ flexDirection: 'row' }}><Icon /><Text>x</Text></View>;`
      )
    ).toEqual(['row-text-no-shrink']);
  });

  it('ignores columns', () => {
    expect(
      rulesIn(`const A = () => <View className="flex-col"><Text>a</Text><Text>b</Text></View>;`)
    ).toEqual([]);
  });
});

describe('row-buttons and row-many-items', () => {
  it('flags two Buttons that share a row without flex-1', () => {
    expect(
      rulesIn(
        `const A = () => <View className="flex-row gap-2"><Button label="Cancel" /><Button label="Save" /></View>;`
      )
    ).toEqual(['row-buttons']);
  });

  it('accepts Buttons that split the row with flex-1', () => {
    expect(
      rulesIn(
        `const A = () => <View className="flex-row"><Button className="flex-1" label="a" /><Button className="flex-1" label="b" /></View>;`
      )
    ).toEqual([]);
  });

  it('flags four static children in a row that cannot wrap, but not a mapped list', () => {
    expect(
      rulesIn(`const A = () => <View className="flex-row"><A1 /><A2 /><A3 /><A4 /></View>;`)
    ).toEqual(['row-many-items']);
    expect(
      rulesIn(
        `const A = () => <View className="flex-row">{items.map((i) => <Chip key={i} />)}<A1 /><A2 /><A3 /></View>;`
      )
    ).toEqual([]);
  });
});

describe('fixed sizes', () => {
  it('flags a literal width of 240 or more, in a class or a style', () => {
    expect(rulesIn(`const A = () => <View className="w-[300px]" />;`)).toEqual(['fixed-width']);
    expect(rulesIn(`const A = () => <View className="min-w-[260]" />;`)).toEqual(['fixed-width']);
    expect(rulesIn(`const A = () => <View style={{ width: 320 }} />;`)).toEqual(['fixed-width']);
  });

  it('ignores narrow and relative widths', () => {
    expect(rulesIn(`const A = () => <View className="w-[100px]" />;`)).toEqual([]);
    expect(rulesIn(`const A = () => <View style={{ width: '100%' }} />;`)).toEqual([]);
    expect(rulesIn(`const A = () => <View className="w-full" />;`)).toEqual([]);
  });

  it('flags a literal height around text that does not limit its lines', () => {
    expect(
      rulesIn(`const A = () => <View className="h-[40px]"><Text>Label</Text></View>;`)
    ).toEqual(['fixed-height-text']);
    expect(
      rulesIn(
        `const A = () => <View className="h-[40px]"><Text numberOfLines={1}>Label</Text></View>;`
      )
    ).toEqual([]);
    expect(rulesIn(`const A = () => <View className="h-[40px]"><Icon /></View>;`)).toEqual([]);
  });
});

describe('overlays and window math', () => {
  it('flags an absolutely positioned sibling of text', () => {
    expect(
      rulesIn(
        `const A = () => <View><Text>Title</Text><View className="absolute right-0" /></View>;`
      )
    ).toEqual(['absolute-over-text']);
  });

  it('flags manual window-size arithmetic', () => {
    expect(
      rulesIn(`const A = () => { const { width } = useWindowDimensions(); return null; };`)
    ).toEqual(['window-math']);
    expect(rulesIn(`const w = Dimensions.get('window').width;`)).toEqual(['window-math']);
  });
});

describe('scoring', () => {
  it('sums the weights and reports each finding with its line', () => {
    const result = scanSource(
      `const A = () => (
  <View className="flex-row w-[300px]">
    <Icon />
    <Text>Label</Text>
  </View>
);`,
      'Sample.tsx'
    );
    expect(result.score).toBe(RULES['row-text-no-shrink'].weight + RULES['fixed-width'].weight);
    expect(result.findings.every((finding) => finding.line === 2)).toBe(true);
    expect(result.findings.map((finding) => finding.rule).sort()).toEqual([
      'fixed-width',
      'row-text-no-shrink',
    ]);
  });

  it('scores clean code at zero', () => {
    expect(
      scanSource(`const A = () => <View className="flex-1"><Text>Hi</Text></View>;`, 'Clean.tsx')
        .score
    ).toBe(0);
  });

  it('ranks files by score, highest first, and leaves out the website and tests', () => {
    const results = scanFiles(['components']);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.score > 0)).toBe(true);
    expect(results.map((result) => result.score)).toEqual(
      [...results.map((r) => r.score)].sort((a, b) => b - a)
    );
    expect(results.some((result) => /(^|\/)website(\/|$)|__tests__/.test(result.file))).toBe(false);
  });
});
