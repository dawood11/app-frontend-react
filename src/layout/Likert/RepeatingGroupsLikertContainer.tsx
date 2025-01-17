import React from 'react';

import { Table, TableBody, TableCell, TableHeader, TableRow } from '@digdir/design-system-react';
import { Grid, Typography } from '@material-ui/core';

import { AltinnSpinner } from 'src/components/AltinnSpinner';
import { Lang } from 'src/features/language/Lang';
import { useGetOptions } from 'src/features/options/useGetOptions';
import { useIsMobileOrTablet } from 'src/hooks/useIsMobile';
import { LayoutStyle } from 'src/layout/common.generated';
import { GenericComponent } from 'src/layout/GenericComponent';
import classes from 'src/layout/Likert/LikertComponent.module.css';
import type { IGenericComponentProps } from 'src/layout/GenericComponent';
import type { CompGroupRepeatingLikertInternal } from 'src/layout/Group/config.generated';
import type { LayoutNodeForGroup } from 'src/layout/Group/LayoutNodeForGroup';
import type { LayoutNode } from 'src/utils/layout/LayoutNode';

type RepeatingGroupsLikertContainerProps = {
  node: LayoutNodeForGroup<CompGroupRepeatingLikertInternal>;
  ref?: React.Ref<HTMLDivElement>;
};

export const RepeatingGroupsLikertContainer = ({ node, ref }: RepeatingGroupsLikertContainerProps) => {
  const firstLikertChild = node?.children((item) => item.type === 'Likert') as LayoutNode<'Likert'> | undefined;
  const mobileView = useIsMobileOrTablet();
  const { options: calculatedOptions, isFetching } = useGetOptions({
    ...(firstLikertChild?.item || {}),
    node,
    valueType: 'single',
    dataModelBindings: undefined,
  });

  const id = node.item.id;
  const hasDescription = !!node?.item.textResourceBindings?.description;
  const hasTitle = !!node?.item.textResourceBindings?.title;
  const titleId = `likert-title-${id}`;
  const descriptionId = `likert-description-${id}`;

  const Header = () => (
    <Grid
      item={true}
      xs={12}
      data-componentid={node?.item.id}
    >
      {hasTitle && (
        <Typography
          component='div'
          variant='h3'
          style={{ width: '100%' }}
          id={titleId}
        >
          <Lang id={node?.item.textResourceBindings?.title} />
        </Typography>
      )}
      {hasDescription && (
        <Typography
          variant='body1'
          gutterBottom
          id={descriptionId}
        >
          <Lang id={node?.item.textResourceBindings?.description} />
        </Typography>
      )}
    </Grid>
  );

  if (mobileView) {
    return (
      <Grid
        item
        container
      >
        <Header />
        <div
          role='group'
          aria-labelledby={(hasTitle && titleId) || undefined}
          aria-describedby={(hasDescription && descriptionId) || undefined}
        >
          {node?.children().map((comp) => {
            if (comp.isType('Group') || comp.isType('Summary')) {
              window.logWarnOnce('Unexpected Group or Summary inside likert container:\n', comp.item.id);
              return;
            }

            return (
              <GenericComponent
                key={comp.item.id}
                node={comp}
              />
            );
          })}
        </div>
      </Grid>
    );
  }

  return (
    <>
      <Header />
      {isFetching ? (
        <AltinnSpinner />
      ) : (
        <div
          className={classes.likertTableContainer}
          ref={ref}
        >
          <Table
            id={id}
            aria-labelledby={(hasTitle && titleId) || undefined}
            aria-describedby={(hasDescription && descriptionId) || undefined}
          >
            <TableHeader id={`likert-table-header-${id}`}>
              <TableRow>
                {node?.item.textResourceBindings?.leftColumnHeader ? (
                  <TableCell>
                    <Lang id={node?.item.textResourceBindings?.leftColumnHeader} />
                  </TableCell>
                ) : (
                  <TableCell />
                )}
                {calculatedOptions.map((option, index) => {
                  const colLabelId = `${id}-likert-columnheader-${index}`;
                  return (
                    <TableCell
                      key={option.value}
                      id={colLabelId}
                      className={classes.likertTableHeaderTop}
                    >
                      <Lang id={option.label} />
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody id={`likert-table-body-${id}`}>
              {node?.children().map((comp) => {
                if (comp.isType('Group') || comp.isType('Summary')) {
                  window.logWarnOnce('Unexpected Group or Summary inside likert container:\n', comp.item.id);
                  return;
                }

                const override: IGenericComponentProps<'Likert'>['overrideItemProps'] = {
                  layout: LayoutStyle.Table,
                };

                return (
                  <GenericComponent
                    key={comp.item.id}
                    node={comp as LayoutNode<'Likert'>}
                    overrideItemProps={override}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};
