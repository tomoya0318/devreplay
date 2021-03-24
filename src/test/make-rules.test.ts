import { makeRules } from '../lib/rule-maker/makeRules';
import { fixWithRules } from '../lib/lint';

test('Test rule maker', async () => {
    const before = 'for (let i = 0;i < arr.length;i++) foo( arr[i] )';
    const after = 'for (const value of arr)) { foo(value) }';
    
    const beforeRegex = 'for\\s*\\(let\\s*i\\s*=\\s*0;i\\s*<\\s*(?<arr>\\S+)\\.length;i\\+\\+\\)\\s*(?<foo>\\S+)\\(\\s*\\k<arr>\\[i\\]\\s*\\)';
    const afterRegex = 'for (const value of $1)) { $2(value) }';
    
    const rule = await makeRules(before, after, 'javascript');
    if (rule === undefined) {
        throw new Error('Rule can not be generated');
    }
    expect(rule.before).toStrictEqual(beforeRegex);
    expect(rule.after).toStrictEqual(afterRegex);

    expect(fixWithRules(before, [rule])).toStrictEqual(after);
});

test('Test rule maker2', async () => {
    const before = 'for (let i = 0;i < arr.length;i++) foo( arr[i] )';
    const after = 'for (let i = 0;i < arr.length;i++) { foo(arr[i]) }';
    const beforeRegex = '(?<foo>\\S+)\\(\\s*(?<arr>\\S+)\\[(?<i>\\S+)\\]\\s*\\)';
    const afterRegex = '{ $1($2[$3]) }';
    
    const rule = await makeRules(before, after, 'javascript');
    if (rule === undefined) {
        throw new Error('Rule can not be generated');
    }
    expect(rule.before).toStrictEqual(beforeRegex);
    expect(rule.after).toStrictEqual(afterRegex);

    expect(fixWithRules(before, [rule])).toStrictEqual(after);
});

test('Test rule maker3', async () => {
    const before = 'for (let i = 0;i < arr.length;i++) { foo(arr[i]) }';
    const after = 'for (let i = 0;i < arr.length;i++) { foo(arr2) }';
    const beforeRegex = 'arr[i]';
    const afterRegex = 'arr2';
    
    const rule = await makeRules(before, after, 'javascript');
    if (rule === undefined) {
        throw new Error('Rule can not be generated');
    }
    expect(rule.before).toStrictEqual(beforeRegex);
    expect(rule.after).toStrictEqual(afterRegex);

    expect(fixWithRules(before, [rule])).toStrictEqual(after);
});