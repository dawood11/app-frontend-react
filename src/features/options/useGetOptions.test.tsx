import React from 'react';

import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { AxiosResponse } from 'axios';

import { useGetOptions } from 'src/features/options/useGetOptions';
import { renderWithNode } from 'src/test/renderWithProviders';
import type { IOption, ISelectionComponentExternal } from 'src/layout/common.generated';
import type { LayoutNode } from 'src/utils/layout/LayoutNode';

/**
 * This is defined because it is possible for the options to be defined as other types than strings, but
 * useGetOptions will always return options as strings. So the internal type is correct, but this represents
 * potential external types.
 */
type IRawOption = Omit<IOption, 'value'> & {
  value: string | number | boolean;
};

interface RenderProps {
  type: 'single' | 'multi';
  via: 'layout' | 'api' | 'repeatingGroups';
  options: IRawOption[];
}

function TestOptions({ node }: { node: LayoutNode<'Dropdown' | 'MultipleSelect'> }) {
  const { options, setData, current, currentStringy } = useGetOptions({
    ...node.item,
    node,
    valueType: node.item.type === 'Dropdown' ? 'single' : 'multi',
  });

  const setterFor = (index: number) => () =>
    (setData as any)(node.item.type === 'Dropdown' ? options[index] : [options[index]]);

  return (
    <>
      <div data-testid='options'>{JSON.stringify(options)}</div>
      <div data-testid='current'>{JSON.stringify(current)}</div>
      <div data-testid='currentStringy'>{JSON.stringify(currentStringy)}</div>
      <button onClick={setterFor(0)}>Choose first option</button>
      <button onClick={setterFor(1)}>Choose second option</button>
      <button onClick={setterFor(2)}>Choose third option</button>
      <button onClick={setterFor(3)}>Choose fourth option</button>
    </>
  );
}

async function render(props: RenderProps) {
  const layoutConfig: ISelectionComponentExternal = {
    options: props.via === 'layout' ? (props.options as unknown as IOption[]) : undefined,
    optionsId: props.via === 'api' ? 'myOptions' : undefined,
    source:
      props.via === 'repeatingGroups'
        ? {
            group: 'Group',
            value: 'Group.value',
            label: 'myLabel',
          }
        : undefined,
  };

  return renderWithNode({
    renderer: ({ node }) => <TestOptions node={node as LayoutNode<'Dropdown' | 'MultipleSelect'>} />,
    nodeId: 'myComponent',
    inInstance: true,
    queries: {
      fetchLayouts: async () => ({
        FormLayout: {
          data: {
            layout: [
              {
                type: props.type === 'single' ? 'Dropdown' : 'MultipleSelect',
                id: 'myComponent',
                dataModelBindings: {
                  simpleBinding: 'result',
                },
                textResourceBindings: {
                  title: 'mockTitle',
                },
                ...layoutConfig,
              },
            ],
          },
        },
      }),
      fetchFormData: async () => ({
        Group: props.options,
        result: '',
      }),
      fetchOptions: async () =>
        ({
          data: props.options,
          headers: {},
        }) as AxiosResponse<IOption[], any>,
      fetchTextResources: async () => ({
        resources: [
          {
            id: 'myLabel',
            value: '{0}',
            variables: [
              {
                dataSource: 'dataModel.default',
                key: 'Group[{0}].label',
              },
            ],
          },
        ],
        language: 'nb',
      }),
    },
  });
}

describe('useGetOptions', () => {
  const permutations: Omit<RenderProps, 'options'>[] = [
    { type: 'single', via: 'layout' },
    { type: 'single', via: 'api' },
    { type: 'single', via: 'repeatingGroups' },
    { type: 'multi', via: 'layout' },
    { type: 'multi', via: 'api' },
    { type: 'multi', via: 'repeatingGroups' },
  ];

  it.each(permutations)('options should be cast to strings for $type + $via', async (props) => {
    const options = [
      { label: 'first', value: 'hello' },
      { label: 'second', value: false },
      { label: 'third', value: 2 },
      { label: 'fourth', value: 3.14 },
    ];
    const { formDataMethods } = await render({
      ...props,
      options,
    });

    const textContent = screen.getByTestId('options').textContent;
    const asArray = JSON.parse(textContent as string) as IOption[];

    expect(asArray).toEqual([
      { label: 'first', value: 'hello' },
      { label: 'second', value: 'false' },
      { label: 'third', value: '2' },
      { label: 'fourth', value: '3.14' },
    ]);

    // Try setting the value to all the options, and observing that the saved value is the stringy version
    for (const option of options) {
      await userEvent.click(screen.getByRole('button', { name: `Choose ${option.label} option` }));
      expect(formDataMethods.setLeafValue).toHaveBeenCalledWith({
        path: 'result',
        newValue: option.value.toString(),
      });
      (formDataMethods.setLeafValue as jest.Mock).mockClear();

      const currentOption = JSON.parse(screen.getByTestId('current').textContent as string);
      if (props.type === 'single') {
        expect(currentOption).toEqual({
          label: option.label,
          value: option.value.toString(),
        });
      } else {
        expect(currentOption).toEqual([
          {
            label: option.label,
            value: option.value.toString(),
          },
        ]);
      }

      const currentStringy = JSON.parse(screen.getByTestId('currentStringy').textContent as string);
      if (props.type === 'single') {
        expect(currentStringy).toEqual(option.value.toString());
      } else {
        expect(currentStringy).toEqual([option.value.toString()]);
      }
    }
  });
});
