import React from 'react';

interface AwsIconProps {
  color?: string;
  size?: number;
}

const AwsIconWrapper: React.FC<React.PropsWithChildren<AwsIconProps>> = ({ 
  children, 
  color = '#FF9900', 
  size = 32 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
};

// AWS Region Icon
export const RegionIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <rect x="4" y="4" width="56" height="56" rx="4" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M20 20 L44 20 L44 44 L20 44 Z" fill={props.color || '#FF9900'} opacity="0.3" />
    <path d="M15 15 L49 15 L49 49 L15 49 Z" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
  </AwsIconWrapper>
);

// AWS VPC Icon
export const VpcIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <path d="M8 8 L56 8 L56 56 L8 56 Z" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M18 18 L46 18 L46 46 L18 46 Z" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M18 18 L46 18 L46 46 L18 46 Z" fill={props.color || '#FF9900'} opacity="0.3" />
  </AwsIconWrapper>
);

// AWS EC2 Instance Icon
export const EC2Icon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <rect x="10" y="14" width="44" height="36" rx="2" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <rect x="10" y="14" width="44" height="36" rx="2" fill={props.color || '#FF9900'} opacity="0.3" />
    <rect x="18" y="22" width="28" height="4" rx="1" fill={props.color || '#FF9900'} />
    <rect x="18" y="30" width="28" height="4" rx="1" fill={props.color || '#FF9900'} />
    <rect x="18" y="38" width="28" height="4" rx="1" fill={props.color || '#FF9900'} />
  </AwsIconWrapper>
);

// AWS Subnet Icon
export const SubnetIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <rect x="12" y="12" width="40" height="40" rx="2" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <rect x="12" y="12" width="40" height="40" rx="2" fill={props.color || '#FF9900'} opacity="0.3" />
    <path d="M20 32 L44 32" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M32 20 L32 44" stroke={props.color || '#FF9900'} strokeWidth="2" />
  </AwsIconWrapper>
);

// AWS Security Group Icon
export const SecurityGroupIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <path d="M32 10 L50 20 L50 44 L32 54 L14 44 L14 20 Z" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M32 10 L50 20 L50 44 L32 54 L14 44 L14 20 Z" fill={props.color || '#FF9900'} opacity="0.3" />
    <circle cx="32" cy="32" r="8" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
  </AwsIconWrapper>
);

// AWS S3 Bucket Icon
export const S3Icon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <path d="M14 20 C14 16.13 21.16 13 30 13 C38.84 13 46 16.13 46 20 L46 44 C46 47.87 38.84 51 30 51 C21.16 51 14 47.87 14 44 Z" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M14 20 C14 23.87 21.16 27 30 27 C38.84 27 46 23.87 46 20" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M14 32 C14 35.87 21.16 39 30 39 C38.84 39 46 35.87 46 32" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <path d="M14 20 C14 16.13 21.16 13 30 13 C38.84 13 46 16.13 46 20 L46 44 C46 47.87 38.84 51 30 51 C21.16 51 14 47.87 14 44 Z" fill={props.color || '#FF9900'} opacity="0.3" />
  </AwsIconWrapper>
);

// AWS RDS Instance Icon
export const RDSIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <rect x="10" y="18" width="44" height="28" rx="2" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <rect x="10" y="18" width="44" height="28" rx="2" fill={props.color || '#FF9900'} opacity="0.3" />
    <circle cx="22" cy="32" r="6" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <rect x="32" y="26" width="16" height="4" rx="1" fill={props.color || '#FF9900'} />
    <rect x="32" y="34" width="16" height="4" rx="1" fill={props.color || '#FF9900'} />
  </AwsIconWrapper>
);

// AWS Lambda Function Icon
export const LambdaIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <rect x="12" y="12" width="40" height="40" rx="2" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <rect x="12" y="12" width="40" height="40" rx="2" fill={props.color || '#FF9900'} opacity="0.3" />
    <path d="M22 22 L32 42 L42 22" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
  </AwsIconWrapper>
);

// AWS Internet Gateway Icon
export const IGWIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <circle cx="32" cy="32" r="20" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <circle cx="32" cy="32" r="20" fill={props.color || '#FF9900'} opacity="0.3" />
    <path d="M22 32 L42 32" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M32 22 L32 42" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M25 25 L39 39" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M39 25 L25 39" stroke={props.color || '#FF9900'} strokeWidth="2" />
  </AwsIconWrapper>
);

// AWS Route Table Icon
export const RouteTableIcon: React.FC<AwsIconProps> = (props) => (
  <AwsIconWrapper {...props}>
    <rect x="12" y="12" width="40" height="40" rx="2" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
    <rect x="12" y="12" width="40" height="40" rx="2" fill={props.color || '#FF9900'} opacity="0.3" />
    <path d="M12 22 L52 22" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M12 32 L52 32" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M12 42 L52 42" stroke={props.color || '#FF9900'} strokeWidth="2" />
    <path d="M22 12 L22 52" stroke={props.color || '#FF9900'} strokeWidth="2" />
  </AwsIconWrapper>
);

// Map component types to their icons
export const getAwsIconByType = (type: string, props: AwsIconProps = {}): React.ReactElement => {
  switch (type) {
    case 'RegionComponent':
      return <RegionIcon {...props} />;
    case 'VpcComponent':
      return <VpcIcon {...props} />;
    case 'EC2InstanceComponent':
      return <EC2Icon {...props} />;
    case 'SubnetComponent':
      return <SubnetIcon {...props} />;
    case 'SecurityGroupComponent':
      return <SecurityGroupIcon {...props} />;
    case 'S3BucketComponent':
      return <S3Icon {...props} />;
    case 'RDSInstanceComponent':
      return <RDSIcon {...props} />;
    case 'LambdaFunctionComponent':
      return <LambdaIcon {...props} />;
    case 'InternetGatewayComponent':
      return <IGWIcon {...props} />;
    case 'RouteTableComponent':
      return <RouteTableIcon {...props} />;
    default:
      return (
        <AwsIconWrapper {...props}>
          <rect x="12" y="12" width="40" height="40" rx="4" stroke={props.color || '#FF9900'} strokeWidth="2" fill="none" />
          <text x="32" y="36" fontSize="10" textAnchor="middle" fill={props.color || '#FF9900'}>
            {type.substring(0, 2).toUpperCase()}
          </text>
        </AwsIconWrapper>
      );
  }
};